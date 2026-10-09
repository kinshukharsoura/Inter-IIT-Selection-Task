import { Router } from 'express';
import { units } from '../controllers/ingredient.controller';
import * as shoppingList from '../controllers/shoppingList.controller';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { sendSuccess } from '../utils/http';
import { authRouter } from './auth.routes';
import { ingredientRouter } from './ingredient.routes';
import { recipeRouter } from './recipe.routes';

export function buildApiRouter(): Router {
  const api = Router();

  // Public
  api.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    sendSuccess(res, { status: 'ok', database: 'up', timestamp: new Date().toISOString() });
  });
  api.use('/auth', authRouter);

  // Protected: every recipe-management endpoint requires a valid JWT.
  api.use('/recipes', authenticate, recipeRouter);
  api.use('/ingredients', authenticate, ingredientRouter);
  api.get('/units', authenticate, units);
  api.post('/shopping-list', authenticate, shoppingList.create);

  return api;
}
