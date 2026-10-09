import { Request, Response } from 'express';
import { currentUserId } from '../middleware/authenticate';
import { buildShoppingList } from '../services/shoppingList.service';
import { sendSuccess } from '../utils/http';
import { shoppingListSchema } from '../validators/recipe.validators';

export async function create(req: Request, res: Response) {
  const input = shoppingListSchema.parse(req.body);
  sendSuccess(res, await buildShoppingList(currentUserId(req), input));
}
