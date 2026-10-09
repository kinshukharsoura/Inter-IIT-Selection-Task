/**
 * Plain in-memory representation of a user's recipe graph. The recursive
 * algorithms in this folder operate only on these types, so they are pure and
 * can be unit-tested without a database.
 */

export interface IngredientComponentData {
  id: string;
  type: 'ingredient';
  position: number;
  quantity: number;
  unit: string;
  ingredientId: string;
  ingredientName: string;
}

export interface RecipeComponentData {
  id: string;
  type: 'recipe';
  position: number;
  quantity: number;
  /** "batch" or "serving" — see scaling.ts. */
  unit: string;
  childRecipeId: string;
}

export type ComponentData = IngredientComponentData | RecipeComponentData;

export interface RecipeData {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  servings: number;
  components: ComponentData[];
}

/** All recipes reachable from some root, keyed by id. */
export type RecipeGraph = ReadonlyMap<string, RecipeData>;

/** Adjacency list: recipe id -> ids of recipes it directly uses. */
export type DependencyGraph = ReadonlyMap<string, readonly string[]>;
