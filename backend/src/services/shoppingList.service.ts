import { computeCombinedTotals } from '../domain/ingredientTotals';
import { prisma } from '../lib/prisma';
import { forbidden, notFound } from '../utils/errors';
import { ShoppingListInput } from '../validators/recipe.validators';
import { loadRecipeGraph } from './recipeGraph.service';

/**
 * Builds one consolidated shopping list for several recipes, each scaled to its
 * own number of servings. Reuses the same recursive expansion as a single
 * recipe's "Total Ingredients", with one memo shared across all recipes.
 */
export async function buildShoppingList(userId: string, input: ShoppingListInput) {
  const recipeIds = [...new Set(input.items.map((i) => i.recipeId))];
  const recipes = await prisma.recipe.findMany({
    where: { id: { in: recipeIds } },
    select: { id: true, name: true, servings: true, userId: true },
  });
  if (recipes.length !== recipeIds.length) throw notFound('One or more recipes were not found');
  if (recipes.some((r) => r.userId !== userId))
    throw forbidden('You do not have access to one or more recipes');

  const graph = await loadRecipeGraph(prisma, recipeIds);
  const byId = new Map(recipes.map((r) => [r.id, r]));

  return {
    recipes: input.items.map((item) => {
      const recipe = byId.get(item.recipeId) as (typeof recipes)[number];
      return { id: recipe.id, name: recipe.name, servings: item.servings ?? recipe.servings };
    }),
    ingredients: computeCombinedTotals(graph, input.items),
  };
}
