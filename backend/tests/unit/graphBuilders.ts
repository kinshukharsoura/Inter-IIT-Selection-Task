import { ComponentData, RecipeData } from '../../src/domain/types';

/** Tiny DSL for building in-memory recipe graphs in unit tests. */
export function ing(name: string, quantity: number, unit = 'g'): ComponentData {
  return {
    id: `c-${name}-${quantity}-${unit}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'ingredient',
    position: 0,
    quantity,
    unit,
    ingredientId: `ing-${name.toLowerCase()}`,
    ingredientName: name,
  };
}

export function sub(
  recipeId: string,
  quantity = 1,
  unit: 'batch' | 'serving' = 'batch',
): ComponentData {
  return {
    id: `c-${recipeId}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'recipe',
    position: 0,
    quantity,
    unit,
    childRecipeId: recipeId,
  };
}

export function recipe(id: string, servings: number, components: ComponentData[]): RecipeData {
  return {
    id,
    name: id,
    description: null,
    category: null,
    servings,
    components: components.map((c, position) => ({ ...c, position })),
  };
}

export function graphOf(...recipes: RecipeData[]): Map<string, RecipeData> {
  return new Map(recipes.map((r) => [r.id, r]));
}
