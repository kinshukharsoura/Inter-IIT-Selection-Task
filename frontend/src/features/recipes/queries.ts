import {
  keepPreviousData,
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ingredientsApi, RecipeFilters, recipesApi } from '../../api/endpoints';
import type { RecipeInput } from '../../api/types';

export const recipeKeys = {
  all: ['recipes'] as const,
  list: (filters: RecipeFilters) => ['recipes', 'list', filters] as const,
  categories: ['recipes', 'categories'] as const,
  detail: (id: string) => ['recipes', 'detail', id] as const,
  tree: (id: string, servings?: number) => ['recipes', 'tree', id, servings ?? null] as const,
  totals: (id: string, servings?: number) => ['recipes', 'totals', id, servings ?? null] as const,
  usages: (id: string) => ['recipes', 'usages', id] as const,
};

export const ingredientKeys = {
  all: ['ingredients'] as const,
  units: ['units'] as const,
};

/**
 * Any recipe change can affect other recipes' trees and totals (they embed
 * each other), so every recipe-derived query is invalidated together.
 */
function invalidateRecipes(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: recipeKeys.all }),
    queryClient.invalidateQueries({ queryKey: ingredientKeys.all }),
  ]);
}

export function useRecipes(filters: RecipeFilters) {
  return useQuery({
    queryKey: recipeKeys.list(filters),
    queryFn: () => recipesApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useCategories() {
  return useQuery({ queryKey: recipeKeys.categories, queryFn: recipesApi.categories });
}

export function useRecipe(id: string) {
  return useQuery({ queryKey: recipeKeys.detail(id), queryFn: () => recipesApi.get(id) });
}

export function useRecipeTree(id: string, servings?: number) {
  return useQuery({
    queryKey: recipeKeys.tree(id, servings),
    queryFn: () => recipesApi.tree(id, servings),
    placeholderData: keepPreviousData,
  });
}

export function useIngredientTotals(id: string, servings?: number) {
  return useQuery({
    queryKey: recipeKeys.totals(id, servings),
    queryFn: () => recipesApi.totals(id, servings),
    placeholderData: keepPreviousData,
  });
}

export function useRecipeUsages(id: string | undefined) {
  return useQuery({
    queryKey: recipeKeys.usages(id ?? ''),
    queryFn: () => recipesApi.usages(id as string),
    enabled: Boolean(id),
  });
}

export function useIngredients() {
  return useQuery({ queryKey: ingredientKeys.all, queryFn: () => ingredientsApi.list() });
}

export function useUnits() {
  return useQuery({
    queryKey: ingredientKeys.units,
    queryFn: ingredientsApi.units,
    staleTime: Infinity,
  });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecipeInput) => recipesApi.create(input),
    onSuccess: () => invalidateRecipes(queryClient),
  });
}

export function useUpdateRecipe(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecipeInput) => recipesApi.update(id, input),
    onSuccess: () => invalidateRecipes(queryClient),
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recipesApi.remove(id),
    onSuccess: (_data, id) => {
      // Drop (rather than refetch) every query of the deleted recipe: detail, tree, totals, usages.
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] === 'recipes' && query.queryKey[2] === id,
      });
      return invalidateRecipes(queryClient);
    },
  });
}

export function useDuplicateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recipesApi.duplicate(id),
    onSuccess: () => invalidateRecipes(queryClient),
  });
}

export function useCreateIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ingredientsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ingredientKeys.all }),
  });
}
