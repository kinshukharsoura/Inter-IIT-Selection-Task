import { Router } from 'express';
import * as ingredients from '../controllers/ingredient.controller';

export const ingredientRouter = Router();
ingredientRouter.get('/', ingredients.list);
ingredientRouter.post('/', ingredients.create);
ingredientRouter.get('/:id', ingredients.get);
ingredientRouter.put('/:id', ingredients.update);
ingredientRouter.delete('/:id', ingredients.remove);
