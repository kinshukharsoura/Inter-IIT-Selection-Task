import { Router } from 'express';
import * as components from '../controllers/component.controller';
import * as recipes from '../controllers/recipe.controller';

export const recipeRouter = Router();

recipeRouter.get('/', recipes.list);
recipeRouter.get('/categories', recipes.categories);
recipeRouter.post('/', recipes.create);
recipeRouter.get('/:id', recipes.get);
recipeRouter.put('/:id', recipes.update);
recipeRouter.delete('/:id', recipes.remove);

// Recursive views
recipeRouter.get('/:id/tree', recipes.tree);
recipeRouter.get('/:id/ingredients', recipes.ingredientTotals);
recipeRouter.get('/:id/usages', recipes.usages);
recipeRouter.post('/:id/duplicate', recipes.duplicate);

// Components ("order" is registered before ":componentId" so it is not captured as an id)
recipeRouter.post('/:id/components', components.add);
recipeRouter.put('/:id/components/order', components.reorder);
recipeRouter.put('/:id/components/:componentId', components.update);
recipeRouter.delete('/:id/components/:componentId', components.remove);
