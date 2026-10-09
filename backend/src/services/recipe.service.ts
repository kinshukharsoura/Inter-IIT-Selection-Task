import { Prisma } from '@prisma/client';
import { collectReachable } from '../domain/cycleDetection';
import { computeIngredientTotals } from '../domain/ingredientTotals';
import { buildRecipeTree } from '../domain/recipeTree';
import { prisma, Tx } from '../lib/prisma';
import { badRequest, conflict } from '../utils/errors';
import {
  ComponentInput,
  ComponentSyncInput,
  CreateRecipeInput,
  ListRecipesQuery,
  UpdateRecipeInput,
} from '../validators/recipe.validators';
import { assertValidTargets } from './componentTargets.service';
import { componentSelect, toComponentDto } from './mappers';
import { assertRecipeNameAvailable, getOwnedRecipe } from './recipeAccess';
import {
  loadDependencyGraph,
  loadRecipeGraph,
  withUserGraphLock,
  reverseGraph,
} from './recipeGraph.service';

const recipeSummarySelect = {
  id: true,
  name: true,
  description: true,
  category: true,
  servings: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { components: true, usedIn: true } },
} satisfies Prisma.RecipeSelect;

type RecipeSummaryRow = Prisma.RecipeGetPayload<{ select: typeof recipeSummarySelect }>;

function toSummaryDto(row: RecipeSummaryRow) {
  const { _count, ...rest } = row;
  return { ...rest, componentCount: _count.components, usedInCount: _count.usedIn };
}

/** Columns written for a component, derived from a validated input. */
export function componentData(input: ComponentInput) {
  return input.type === 'ingredient'
    ? {
        ingredientId: input.ingredientId,
        childRecipeId: null,
        quantity: input.quantity,
        unit: input.unit,
      }
    : {
        ingredientId: null,
        childRecipeId: input.recipeId,
        quantity: input.quantity,
        unit: input.unit,
      };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listRecipes(userId: string, query: ListRecipesQuery) {
  const where: Prisma.RecipeWhereInput = { userId };
  if (query.category) where.category = { equals: query.category, mode: 'insensitive' };
  if (query.search) {
    const contains = { contains: query.search, mode: Prisma.QueryMode.insensitive };
    // Matches the recipe itself, or any recipe/ingredient it directly uses (dependency search).
    where.OR = [
      { name: contains },
      { description: contains },
      { category: contains },
      { components: { some: { ingredient: { name: contains } } } },
      { components: { some: { childRecipe: { name: contains } } } },
    ];
  }

  const orderBy: Prisma.RecipeOrderByWithRelationInput =
    query.sort === 'name'
      ? { name: 'asc' }
      : query.sort === 'created'
        ? { createdAt: 'desc' }
        : { updatedAt: 'desc' };

  const rows = await prisma.recipe.findMany({ where, orderBy, select: recipeSummarySelect });
  return rows.map(toSummaryDto);
}

export async function listCategories(userId: string): Promise<string[]> {
  const rows = await prisma.recipe.findMany({
    where: { userId, category: { not: null } },
    distinct: ['category'],
    select: { category: true },
    orderBy: { category: 'asc' },
  });
  return rows.map((r) => r.category as string);
}

export async function getRecipe(userId: string, recipeId: string) {
  await getOwnedRecipe(prisma, userId, recipeId);
  const recipe = await prisma.recipe.findUniqueOrThrow({
    where: { id: recipeId },
    select: {
      ...recipeSummarySelect,
      components: { orderBy: { position: 'asc' }, select: componentSelect },
      usedIn: {
        select: { recipe: { select: { id: true, name: true } } },
        distinct: ['recipeId'],
      },
    },
  });
  const { components, usedIn, ...summary } = recipe;
  return {
    ...toSummaryDto(summary),
    components: components.map(toComponentDto),
    usedIn: usedIn.map((u) => u.recipe),
  };
}

/** Fully expanded composition tree, scaled to `servings` (defaults to the recipe's own). */
export async function getRecipeTree(userId: string, recipeId: string, servings?: number) {
  await getOwnedRecipe(prisma, userId, recipeId);
  const graph = await loadRecipeGraph(prisma, [recipeId]);
  return buildRecipeTree(graph, recipeId, servings);
}

/** Consolidated raw-ingredient requirements, scaled to `servings`. */
export async function getIngredientTotals(userId: string, recipeId: string, servings?: number) {
  const recipe = await getOwnedRecipe(prisma, userId, recipeId);
  const graph = await loadRecipeGraph(prisma, [recipeId]);
  return {
    recipeId,
    name: recipe.name,
    baseServings: recipe.servings,
    servings: servings ?? recipe.servings,
    ingredients: computeIngredientTotals(graph, recipeId, servings),
  };
}

/**
 * Which recipes use this recipe: directly (one level up) and transitively
 * (any level up). The transitive set is exactly the set of recipes that can NOT
 * be added as a component of this recipe without creating a cycle.
 */
export async function getRecipeUsages(userId: string, recipeId: string) {
  await getOwnedRecipe(prisma, userId, recipeId);
  const graph = await loadDependencyGraph(prisma, userId);
  const reversed = reverseGraph(graph);
  const directIds = new Set(reversed.get(recipeId) ?? []);
  const allIds = collectReachable(reversed, recipeId);

  const recipes = await prisma.recipe.findMany({
    where: { id: { in: [...allIds] } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return {
    direct: recipes.filter((r) => directIds.has(r.id)),
    transitive: recipes,
  };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createRecipe(userId: string, input: CreateRecipeInput) {
  const id = await withUserGraphLock(userId, async (tx) => {
    await assertRecipeNameAvailable(tx, userId, input.name);
    // A brand-new recipe cannot be part of a cycle: nothing references it yet.
    await assertValidTargets(tx, userId, null, input.components);

    const recipe = await tx.recipe.create({
      data: {
        userId,
        name: input.name,
        description: input.description,
        category: input.category,
        servings: input.servings,
        components: {
          create: input.components.map((c, position) => ({ ...componentData(c), position })),
        },
      },
      select: { id: true },
    });
    return recipe.id;
  });
  return getRecipe(userId, id);
}

export async function updateRecipe(userId: string, recipeId: string, input: UpdateRecipeInput) {
  await withUserGraphLock(userId, async (tx) => {
    await getOwnedRecipe(tx, userId, recipeId);
    if (input.name !== undefined) await assertRecipeNameAvailable(tx, userId, input.name, recipeId);

    await tx.recipe.update({
      where: { id: recipeId },
      data: {
        name: input.name,
        description: input.description,
        category: input.category,
        servings: input.servings,
        updatedAt: new Date(),
      },
    });

    if (input.components) await syncComponents(tx, userId, recipeId, input.components);
  });
  return getRecipe(userId, recipeId);
}

/**
 * Replaces a recipe's component list with `desired` (in order): components
 * carrying an existing `id` are updated in place, new ones are created and
 * omitted ones are deleted.
 */
async function syncComponents(
  tx: Tx,
  userId: string,
  recipeId: string,
  desired: ComponentSyncInput[],
) {
  const existing = await tx.recipeComponent.findMany({ where: { recipeId }, select: { id: true } });
  const existingIds = new Set(existing.map((c) => c.id));

  const seen = new Set<string>();
  for (const c of desired) {
    if (!c.id) continue;
    if (!existingIds.has(c.id))
      throw badRequest(`Component ${c.id} does not belong to this recipe`);
    if (seen.has(c.id)) throw badRequest(`Component ${c.id} is listed more than once`);
    seen.add(c.id);
  }

  await assertValidTargets(tx, userId, recipeId, desired);

  const removed = [...existingIds].filter((id) => !seen.has(id));
  if (removed.length > 0) await tx.recipeComponent.deleteMany({ where: { id: { in: removed } } });

  for (const [position, c] of desired.entries()) {
    const data = { ...componentData(c), position };
    if (c.id) await tx.recipeComponent.update({ where: { id: c.id }, data });
    else await tx.recipeComponent.create({ data: { ...data, recipeId } });
  }
}

/**
 * Deletes a recipe. Rejected (409) while other recipes use it as a component,
 * because silently removing it would change those recipes.
 */
export async function deleteRecipe(userId: string, recipeId: string): Promise<void> {
  await withUserGraphLock(userId, async (tx) => {
    await getOwnedRecipe(tx, userId, recipeId);

    const parents = await tx.recipeComponent.findMany({
      where: { childRecipeId: recipeId },
      select: { recipe: { select: { id: true, name: true } } },
      distinct: ['recipeId'],
    });
    if (parents.length > 0) {
      const names = parents.map((p) => p.recipe.name);
      throw conflict(
        `This recipe cannot be deleted because it is used by: ${names.join(', ')}. Remove it from those recipes first.`,
        { usedBy: parents.map((p) => p.recipe) },
      );
    }

    await tx.recipe.delete({ where: { id: recipeId } });
  });
}

/** Copies a recipe (its own fields and component lines; sub-recipes are referenced, not copied). */
export async function duplicateRecipe(userId: string, recipeId: string, requestedName?: string) {
  const id = await withUserGraphLock(userId, async (tx) => {
    const source = await getOwnedRecipe(tx, userId, recipeId);
    const components = await tx.recipeComponent.findMany({
      where: { recipeId },
      orderBy: { position: 'asc' },
    });

    const name = requestedName ?? (await nextCopyName(tx, userId, source.name));
    await assertRecipeNameAvailable(tx, userId, name);

    const copy = await tx.recipe.create({
      data: {
        userId,
        name,
        description: source.description,
        category: source.category,
        servings: source.servings,
        components: {
          create: components.map((c) => ({
            ingredientId: c.ingredientId,
            childRecipeId: c.childRecipeId,
            quantity: c.quantity,
            unit: c.unit,
            position: c.position,
          })),
        },
      },
      select: { id: true },
    });
    return copy.id;
  });
  return getRecipe(userId, id);
}

async function nextCopyName(tx: Tx, userId: string, baseName: string): Promise<string> {
  const rows = await tx.recipe.findMany({
    where: { userId, name: { startsWith: `${baseName} (copy`, mode: 'insensitive' } },
    select: { name: true },
  });
  const taken = new Set(rows.map((r) => r.name.toLowerCase()));
  let candidate = `${baseName} (copy)`;
  for (let n = 2; taken.has(candidate.toLowerCase()); n += 1) candidate = `${baseName} (copy ${n})`;
  return candidate;
}
