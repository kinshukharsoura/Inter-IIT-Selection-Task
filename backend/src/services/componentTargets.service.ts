import { detectCycleOnAdd } from '../domain/cycleDetection';
import { nestingDepthWithEdge } from '../domain/dependencyDepth';
import { MAX_RECIPE_DEPTH } from '../domain/recipeTree';
import { Tx } from '../lib/prisma';
import { badRequest, conflict, forbidden, unprocessable } from '../utils/errors';
import { loadDependencyGraph, reverseGraph } from './recipeGraph.service';

type TargetRef =
  { type: 'ingredient'; ingredientId: string } | { type: 'recipe'; recipeId: string };

export const CIRCULAR_DEPENDENCY_MESSAGE = 'Adding this recipe would create a circular dependency';

/**
 * Validates the targets of components that are about to be attached to
 * `parentRecipeId` (null when the parent is being created and nothing can
 * reference it yet):
 *
 *   - every ingredient must exist;
 *   - every sub-recipe must exist and belong to the same user;
 *   - no sub-recipe may introduce a circular dependency (including A → A).
 *
 * Uses one query per target kind (no N+1) plus one query for the dependency graph.
 * Must run inside the transaction that holds `lockUserRecipeGraph`.
 */
export async function assertValidTargets(
  tx: Tx,
  userId: string,
  parentRecipeId: string | null,
  components: readonly TargetRef[],
): Promise<void> {
  const ingredientIds = unique(
    components.flatMap((c) => (c.type === 'ingredient' ? [c.ingredientId] : [])),
  );
  const recipeIds = unique(components.flatMap((c) => (c.type === 'recipe' ? [c.recipeId] : [])));

  if (ingredientIds.length > 0) {
    const found = await tx.ingredient.findMany({
      where: { id: { in: ingredientIds } },
      select: { id: true },
    });
    const missing = difference(
      ingredientIds,
      found.map((i) => i.id),
    );
    if (missing.length > 0) {
      throw badRequest(`Ingredient not found: ${missing.join(', ')}`, { ingredientIds: missing });
    }
  }

  if (recipeIds.length === 0) return;

  if (parentRecipeId && recipeIds.includes(parentRecipeId)) {
    throw conflict(`${CIRCULAR_DEPENDENCY_MESSAGE}: a recipe cannot contain itself`, {
      cycle: [parentRecipeId, parentRecipeId],
    });
  }

  const recipes = await tx.recipe.findMany({
    where: { id: { in: recipeIds } },
    select: { id: true, userId: true },
  });
  const missing = difference(
    recipeIds,
    recipes.map((r) => r.id),
  );
  if (missing.length > 0) {
    throw badRequest(`Referenced recipe not found: ${missing.join(', ')}`, { recipeIds: missing });
  }
  if (recipes.some((r) => r.userId !== userId)) {
    throw forbidden('You can only use your own recipes as components');
  }

  if (!parentRecipeId) return;
  const graph = await loadDependencyGraph(tx, userId);
  for (const childId of recipeIds) {
    const cycle = detectCycleOnAdd(graph, parentRecipeId, childId);
    if (cycle) {
      const names = await recipeNames(tx, cycle);
      throw conflict(
        `${CIRCULAR_DEPENDENCY_MESSAGE}: ${cycle.map((id) => names.get(id) ?? id).join(' → ')}`,
        {
          cycle,
        },
      );
    }
  }

  // Keep every recipe expandable: the tree/totals refuse nesting deeper than MAX_RECIPE_DEPTH.
  const reversed = reverseGraph(graph);
  for (const childId of recipeIds) {
    if (nestingDepthWithEdge(graph, reversed, parentRecipeId, childId) > MAX_RECIPE_DEPTH) {
      throw unprocessable(`Recipes can be nested at most ${MAX_RECIPE_DEPTH} levels deep`);
    }
  }
}

async function recipeNames(tx: Tx, ids: string[]): Promise<Map<string, string>> {
  const rows = await tx.recipe.findMany({
    where: { id: { in: unique(ids) } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r) => [r.id, r.name]));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function difference(expected: string[], actual: string[]): string[] {
  const present = new Set(actual);
  return expected.filter((id) => !present.has(id));
}
