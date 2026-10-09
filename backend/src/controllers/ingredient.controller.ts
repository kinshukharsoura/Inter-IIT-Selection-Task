import { Request, Response } from 'express';
import { UNITS, RECIPE_COMPONENT_UNITS } from '../domain/units';
import { currentUserId } from '../middleware/authenticate';
import * as ingredientService from '../services/ingredient.service';
import { sendSuccess } from '../utils/http';
import { idParamSchema } from '../validators/common';
import {
  createIngredientSchema,
  listIngredientsQuerySchema,
  updateIngredientSchema,
} from '../validators/ingredient.validators';

export async function list(req: Request, res: Response) {
  const { search } = listIngredientsQuerySchema.parse(req.query);
  sendSuccess(res, await ingredientService.listIngredients(currentUserId(req), search));
}

export async function get(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  sendSuccess(res, await ingredientService.getIngredient(currentUserId(req), id));
}

export async function create(req: Request, res: Response) {
  const input = createIngredientSchema.parse(req.body);
  sendSuccess(res, await ingredientService.createIngredient(currentUserId(req), input), 201);
}

export async function update(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = updateIngredientSchema.parse(req.body);
  sendSuccess(res, await ingredientService.updateIngredient(currentUserId(req), id, input));
}

export async function remove(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await ingredientService.deleteIngredient(currentUserId(req), id);
  sendSuccess(res, { id });
}

/** Supported units, so the frontend never hard-codes them. */
export function units(_req: Request, res: Response) {
  sendSuccess(res, { ingredientUnits: UNITS, recipeUnits: RECIPE_COMPONENT_UNITS });
}
