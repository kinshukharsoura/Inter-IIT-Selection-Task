/** Types mirroring the backend API responses. */

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface RecipeSummary {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  servings: number;
  createdAt: string;
  updatedAt: string;
  componentCount: number;
  usedInCount: number;
}

export type ComponentType = 'ingredient' | 'recipe';
export type RecipeComponentUnit = 'batch' | 'serving';

export interface RecipeComponent {
  id: string;
  type: ComponentType;
  position: number;
  quantity: number;
  unit: string;
  ingredient: { id: string; name: string } | null;
  recipe: { id: string; name: string; servings: number } | null;
}

export interface RecipeDetail extends RecipeSummary {
  components: RecipeComponent[];
  usedIn: { id: string; name: string }[];
}

export interface IngredientTreeNode {
  type: 'ingredient';
  key: string;
  componentId: string;
  ingredientId: string;
  name: string;
  quantity: number;
  baseQuantity: number;
  unit: string;
}

export interface RecipeTreeNode {
  type: 'recipe';
  key: string;
  componentId: string | null;
  recipeId: string;
  name: string;
  description: string | null;
  category: string | null;
  servings: number;
  quantity: number | null;
  unit: string | null;
  scaleFactor: number;
  yieldServings: number;
  depth: number;
  circular: boolean;
  children: TreeNode[];
}

export type TreeNode = IngredientTreeNode | RecipeTreeNode;

export interface IngredientTotal {
  ingredientId: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface IngredientTotals {
  recipeId: string;
  name: string;
  baseServings: number;
  servings: number;
  ingredients: IngredientTotal[];
}

export interface RecipeUsages {
  direct: { id: string; name: string }[];
  transitive: { id: string; name: string }[];
}

export interface Ingredient {
  id: string;
  name: string;
  description: string | null;
  defaultUnit: string | null;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  editable: boolean;
}

export interface UnitDefinition {
  code: string;
  label: string;
  dimension: 'mass' | 'volume' | 'count';
}

export interface UnitsResponse {
  ingredientUnits: UnitDefinition[];
  recipeUnits: RecipeComponentUnit[];
}

export type ComponentInput =
  | { id?: string; type: 'ingredient'; ingredientId: string; quantity: number; unit: string }
  | { id?: string; type: 'recipe'; recipeId: string; quantity: number; unit: RecipeComponentUnit };

export interface RecipeInput {
  name: string;
  description: string | null;
  category: string | null;
  servings: number;
  components: ComponentInput[];
}

export interface ShoppingList {
  recipes: { id: string; name: string; servings: number }[];
  ingredients: IngredientTotal[];
}
