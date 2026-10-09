import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { conflict, forbidden, notFound } from '../utils/errors';
import { CreateIngredientInput, UpdateIngredientInput } from '../validators/ingredient.validators';

const ingredientSelect = {
  id: true,
  name: true,
  description: true,
  defaultUnit: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { components: true } },
} satisfies Prisma.IngredientSelect;

type IngredientRow = Prisma.IngredientGetPayload<{ select: typeof ingredientSelect }>;

function toDto(row: IngredientRow, userId: string) {
  const { _count, createdById, ...rest } = row;
  return {
    ...rest,
    usageCount: _count.components,
    /** Only the creator may edit or delete; dataset ingredients are read-only. */
    editable: createdById === userId,
  };
}

export async function listIngredients(userId: string, search?: string) {
  const rows = await prisma.ingredient.findMany({
    where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
    orderBy: { name: 'asc' },
    select: ingredientSelect,
  });
  return rows.map((r) => toDto(r, userId));
}

export async function getIngredient(userId: string, id: string) {
  const row = await prisma.ingredient.findUnique({ where: { id }, select: ingredientSelect });
  if (!row) throw notFound('Ingredient not found');
  return toDto(row, userId);
}

export async function createIngredient(userId: string, input: CreateIngredientInput) {
  await assertNameAvailable(input.name);
  const row = await prisma.ingredient.create({
    data: { ...input, createdById: userId },
    select: ingredientSelect,
  });
  return toDto(row, userId);
}

export async function updateIngredient(userId: string, id: string, input: UpdateIngredientInput) {
  const ingredient = await getEditableIngredient(userId, id);
  if (input.name !== undefined && input.name !== ingredient.name) {
    await assertNameAvailable(input.name, id);
    // Ingredients are shared: renaming must not silently change other users' recipes.
    const usedByOthers = await prisma.recipeComponent.count({
      where: { ingredientId: id, recipe: { userId: { not: userId } } },
    });
    if (usedByOthers > 0) {
      throw conflict("This ingredient is used in other users' recipes and cannot be renamed");
    }
  }
  const row = await prisma.ingredient.update({
    where: { id },
    data: input,
    select: ingredientSelect,
  });
  return toDto(row, userId);
}

/** Rejected (409) while any recipe uses the ingredient. */
export async function deleteIngredient(userId: string, id: string): Promise<void> {
  await getEditableIngredient(userId, id);
  const usageCount = await prisma.recipeComponent.count({ where: { ingredientId: id } });
  if (usageCount > 0) {
    throw conflict(
      `This ingredient is used in ${usageCount} recipe component(s) and cannot be deleted`,
      { usageCount },
    );
  }
  await prisma.ingredient.delete({ where: { id } });
}

async function getEditableIngredient(userId: string, id: string) {
  const ingredient = await prisma.ingredient.findUnique({ where: { id } });
  if (!ingredient) throw notFound('Ingredient not found');
  if (ingredient.createdById !== userId) {
    throw forbidden('Only the user who created this ingredient can modify it');
  }
  return ingredient;
}

async function assertNameAvailable(name: string, excludeId?: string): Promise<void> {
  const clash = await prisma.ingredient.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw conflict(`An ingredient named "${name}" already exists`);
}
