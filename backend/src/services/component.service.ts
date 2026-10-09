import { isIngredientUnit, isRecipeComponentUnit, RECIPE_COMPONENT_UNITS } from '../domain/units';
import { Tx } from '../lib/prisma';
import { badRequest, notFound } from '../utils/errors';
import { ComponentInput, UpdateComponentInput } from '../validators/recipe.validators';
import { assertValidTargets } from './componentTargets.service';
import { componentSelect, toComponentDto } from './mappers';
import { getOwnedRecipe, touchRecipe } from './recipeAccess';
import { withUserGraphLock } from './recipeGraph.service';
import { componentData } from './recipe.service';

export async function addComponent(userId: string, recipeId: string, input: ComponentInput) {
  return withUserGraphLock(userId, async (tx) => {
    await getOwnedRecipe(tx, userId, recipeId);
    await assertValidTargets(tx, userId, recipeId, [input]);

    const last = await tx.recipeComponent.findFirst({
      where: { recipeId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const component = await tx.recipeComponent.create({
      data: { ...componentData(input), recipeId, position: last ? last.position + 1 : 0 },
      select: componentSelect,
    });
    await touchRecipe(tx, recipeId);
    return toComponentDto(component);
  });
}

/** Updates quantity / unit / position of one component. Its target cannot change. */
export async function updateComponent(
  userId: string,
  recipeId: string,
  componentId: string,
  input: UpdateComponentInput,
) {
  return withUserGraphLock(userId, async (tx) => {
    await getOwnedRecipe(tx, userId, recipeId);
    const component = await getComponentOfRecipe(tx, recipeId, componentId);

    if (input.unit !== undefined) {
      const isRecipeLine = component.childRecipeId !== null;
      if (isRecipeLine && !isRecipeComponentUnit(input.unit)) {
        throw badRequest(
          `Unit for a recipe component must be one of: ${RECIPE_COMPONENT_UNITS.join(', ')}`,
        );
      }
      if (!isRecipeLine && !isIngredientUnit(input.unit)) {
        throw badRequest(`Unsupported unit "${input.unit}"`);
      }
    }

    await tx.recipeComponent.update({
      where: { id: componentId },
      data: { quantity: input.quantity, unit: input.unit },
    });
    if (input.position !== undefined)
      await moveComponent(tx, recipeId, componentId, input.position);
    await touchRecipe(tx, recipeId);

    const updated = await tx.recipeComponent.findUniqueOrThrow({
      where: { id: componentId },
      select: componentSelect,
    });
    return toComponentDto(updated);
  });
}

export async function deleteComponent(userId: string, recipeId: string, componentId: string) {
  await withUserGraphLock(userId, async (tx) => {
    await getOwnedRecipe(tx, userId, recipeId);
    await getComponentOfRecipe(tx, recipeId, componentId);
    await tx.recipeComponent.delete({ where: { id: componentId } });

    const remaining = await orderedComponentIds(tx, recipeId);
    await writePositions(tx, remaining);
    await touchRecipe(tx, recipeId);
  });
}

/** Sets the full order of a recipe's components. `componentIds` must be a permutation of them. */
export async function reorderComponents(userId: string, recipeId: string, componentIds: string[]) {
  return withUserGraphLock(userId, async (tx) => {
    await getOwnedRecipe(tx, userId, recipeId);

    const current = await orderedComponentIds(tx, recipeId);
    const isPermutation =
      componentIds.length === current.length &&
      new Set(componentIds).size === componentIds.length &&
      componentIds.every((id) => current.includes(id));
    if (!isPermutation) {
      throw badRequest('componentIds must list every component of the recipe exactly once');
    }

    await writePositions(tx, componentIds);
    await touchRecipe(tx, recipeId);
    const rows = await tx.recipeComponent.findMany({
      where: { recipeId },
      orderBy: { position: 'asc' },
      select: componentSelect,
    });
    return rows.map(toComponentDto);
  });
}

async function getComponentOfRecipe(tx: Tx, recipeId: string, componentId: string) {
  const component = await tx.recipeComponent.findUnique({ where: { id: componentId } });
  if (!component || component.recipeId !== recipeId) {
    throw notFound('Component not found in this recipe');
  }
  return component;
}

async function moveComponent(tx: Tx, recipeId: string, componentId: string, position: number) {
  const ids = (await orderedComponentIds(tx, recipeId)).filter((id) => id !== componentId);
  ids.splice(Math.min(position, ids.length), 0, componentId);
  await writePositions(tx, ids);
}

async function orderedComponentIds(tx: Tx, recipeId: string): Promise<string[]> {
  const rows = await tx.recipeComponent.findMany({
    where: { recipeId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function writePositions(tx: Tx, orderedIds: string[]): Promise<void> {
  // Sequential: an interactive transaction runs on a single connection anyway.
  for (const [position, id] of orderedIds.entries()) {
    await tx.recipeComponent.update({ where: { id }, data: { position } });
  }
}
