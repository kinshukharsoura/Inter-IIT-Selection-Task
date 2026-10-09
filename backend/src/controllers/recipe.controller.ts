import { Request, Response } from 'express';
import { currentUserId } from '../middleware/authenticate';
import * as recipeService from '../services/recipe.service';
import { sendSuccess } from '../utils/http';
import { idParamSchema, scaleQuerySchema } from '../validators/common';
import {
  createRecipeSchema,
  duplicateRecipeSchema,
  listRecipesQuerySchema,
  updateRecipeSchema,
} from '../validators/recipe.validators';

export async function list(req: Request, res: Response) {
  const query = listRecipesQuerySchema.parse(req.query);
  const recipes = await recipeService.listRecipes(currentUserId(req), query);
  sendSuccess(res, recipes, 200, { count: recipes.length });
}

export async function categories(req: Request, res: Response) {
  sendSuccess(res, await recipeService.listCategories(currentUserId(req)));
}

export async function get(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  sendSuccess(res, await recipeService.getRecipe(currentUserId(req), id));
}

export async function create(req: Request, res: Response) {
  const input = createRecipeSchema.parse(req.body);
  sendSuccess(res, await recipeService.createRecipe(currentUserId(req), input), 201);
}

export async function update(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = updateRecipeSchema.parse(req.body);
  sendSuccess(res, await recipeService.updateRecipe(currentUserId(req), id, input));
}

export async function remove(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await recipeService.deleteRecipe(currentUserId(req), id);
  sendSuccess(res, { id });
}

export async function tree(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { servings } = scaleQuerySchema.parse(req.query);
  sendSuccess(res, await recipeService.getRecipeTree(currentUserId(req), id, servings));
}

export async function ingredientTotals(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { servings } = scaleQuerySchema.parse(req.query);
  sendSuccess(res, await recipeService.getIngredientTotals(currentUserId(req), id, servings));
}

export async function usages(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  sendSuccess(res, await recipeService.getRecipeUsages(currentUserId(req), id));
}

export async function duplicate(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { name } = duplicateRecipeSchema.parse(req.body ?? {});
  sendSuccess(res, await recipeService.duplicateRecipe(currentUserId(req), id, name), 201);
}
