import { Prisma } from '@prisma/client';
import { Db } from '../lib/prisma';
import { conflict, forbidden, notFound } from '../utils/errors';

/**
 * Loads a recipe and enforces ownership. Distinguishes "doesn't exist" (404)
 * from "exists but belongs to someone else" (403).
 */
export async function getOwnedRecipe(db: Db, userId: string, recipeId: string) {
  const recipe = await db.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) throw notFound('Recipe not found');
  if (recipe.userId !== userId) throw forbidden('You do not have access to this recipe');
  return recipe;
}

/** Case-insensitive per-user name uniqueness (also enforced by a unique index). */
export async function assertRecipeNameAvailable(
  db: Db,
  userId: string,
  name: string,
  excludeId?: string,
): Promise<void> {
  const clash = await db.recipe.findFirst({
    where: {
      userId,
      name: { equals: name, mode: Prisma.QueryMode.insensitive },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw conflict(`You already have a recipe named "${name}"`);
}

/** Marks a recipe as modified when only its components changed. */
export async function touchRecipe(db: Db, recipeId: string): Promise<void> {
  await db.recipe.update({ where: { id: recipeId }, data: { updatedAt: new Date() } });
}
