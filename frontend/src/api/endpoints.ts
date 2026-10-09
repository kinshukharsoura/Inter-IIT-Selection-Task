import { apiRequest } from './client';
import type {
  AuthResponse,
  Ingredient,
  IngredientTotals,
  RecipeDetail,
  RecipeInput,
  RecipeSummary,
  RecipeTreeNode,
  RecipeUsages,
  ShoppingList,
  UnitsResponse,
  User,
} from './types';

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }),
  register: (name: string, email: string, password: string) =>
    apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: { name, email, password } }),
  me: () => apiRequest<User>('/auth/me'),
};

export interface RecipeFilters {
  search?: string;
  category?: string;
  sort?: 'updated' | 'created' | 'name';
}

export const recipesApi = {
  list: (filters: RecipeFilters = {}) =>
    apiRequest<RecipeSummary[]>('/recipes', { query: { ...filters } }),
  categories: () => apiRequest<string[]>('/recipes/categories'),
  get: (id: string) => apiRequest<RecipeDetail>(`/recipes/${id}`),
  create: (input: RecipeInput) =>
    apiRequest<RecipeDetail>('/recipes', { method: 'POST', body: input }),
  update: (id: string, input: Partial<RecipeInput>) =>
    apiRequest<RecipeDetail>(`/recipes/${id}`, { method: 'PUT', body: input }),
  remove: (id: string) => apiRequest<{ id: string }>(`/recipes/${id}`, { method: 'DELETE' }),
  duplicate: (id: string) =>
    apiRequest<RecipeDetail>(`/recipes/${id}/duplicate`, { method: 'POST', body: {} }),
  tree: (id: string, servings?: number) =>
    apiRequest<RecipeTreeNode>(`/recipes/${id}/tree`, { query: { servings } }),
  totals: (id: string, servings?: number) =>
    apiRequest<IngredientTotals>(`/recipes/${id}/ingredients`, { query: { servings } }),
  usages: (id: string) => apiRequest<RecipeUsages>(`/recipes/${id}/usages`),
};

export const ingredientsApi = {
  list: (search?: string) => apiRequest<Ingredient[]>('/ingredients', { query: { search } }),
  create: (input: { name: string; description?: string | null; defaultUnit?: string | null }) =>
    apiRequest<Ingredient>('/ingredients', { method: 'POST', body: input }),
  update: (
    id: string,
    input: { name?: string; description?: string | null; defaultUnit?: string | null },
  ) => apiRequest<Ingredient>(`/ingredients/${id}`, { method: 'PUT', body: input }),
  remove: (id: string) => apiRequest<{ id: string }>(`/ingredients/${id}`, { method: 'DELETE' }),
  units: () => apiRequest<UnitsResponse>('/units'),
};

export const shoppingListApi = {
  build: (items: { recipeId: string; servings?: number }[]) =>
    apiRequest<ShoppingList>('/shopping-list', { method: 'POST', body: { items } }),
};
