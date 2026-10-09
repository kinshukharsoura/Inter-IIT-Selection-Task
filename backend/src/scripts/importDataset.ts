import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { findAnyCycle } from '../domain/cycleDetection';
import { isIngredientUnit } from '../domain/units';

/**
 * Importer for the dataset provided with the task (ingredients.json + recipes.json).
 *
 * Dataset format (preserved fields):
 *   ingredient: { id, name, unit }
 *   recipe:     { id, name, category, servings, description, components[] }
 *   component:  { type: "ingredient", ingredient_id, quantity, unit }
 *             | { type: "recipe", recipe_id, quantity }   ← quantity = number of batches
 *
 * Dataset ids are stored as `externalId`, so re-running the import is idempotent
 * (upsert) and imported rows can be traced back to the source file.
 */

const datasetIngredientSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  unit: z.string().optional(),
  description: z.string().optional(),
});

const datasetComponentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ingredient'),
    ingredient_id: z.string().min(1),
    quantity: z.number().positive(),
    unit: z.string().min(1),
  }),
  z.object({
    type: z.literal('recipe'),
    recipe_id: z.string().min(1),
    quantity: z.number().positive().default(1),
    unit: z.enum(['batch', 'serving']).default('batch'),
  }),
]);

const datasetRecipeSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  category: z.string().nullish(),
  servings: z.number().int().positive(),
  description: z.string().nullish(),
  components: z.array(datasetComponentSchema),
});

export const datasetSchema = z.object({
  ingredients: z.array(datasetIngredientSchema),
  recipes: z.array(datasetRecipeSchema),
});

export type Dataset = z.infer<typeof datasetSchema>;

export function readDatasetFromDir(dir: string): Dataset {
  const read = (file: string) =>
    JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as unknown;
  return datasetSchema.parse({
    ingredients: read('ingredients.json'),
    recipes: read('recipes.json'),
  });
}

/** Checks references, units and cycles before anything is written. */
export function validateDataset(dataset: Dataset): void {
  const ingredientIds = new Set(dataset.ingredients.map((i) => i.id));
  const recipeIds = new Set(dataset.recipes.map((r) => r.id));
  const problems: string[] = [];

  for (const recipe of dataset.recipes) {
    for (const c of recipe.components) {
      if (c.type === 'ingredient' && !ingredientIds.has(c.ingredient_id)) {
        problems.push(`${recipe.id}: unknown ingredient ${c.ingredient_id}`);
      }
      if (c.type === 'ingredient' && !isIngredientUnit(c.unit)) {
        problems.push(`${recipe.id}: unsupported unit "${c.unit}"`);
      }
      if (c.type === 'recipe' && !recipeIds.has(c.recipe_id)) {
        problems.push(`${recipe.id}: unknown recipe ${c.recipe_id}`);
      }
    }
  }

  const graph = new Map(
    dataset.recipes.map((r) => [
      r.id,
      r.components.flatMap((c) => (c.type === 'recipe' ? [c.recipe_id] : [])),
    ]),
  );
  const cycle = findAnyCycle(graph);
  if (cycle) problems.push(`circular dependency: ${cycle.join(' → ')}`);

  if (problems.length > 0) {
    throw new Error(`Dataset is invalid:\n  - ${problems.join('\n  - ')}`);
  }
}

export interface ImportSummary {
  ingredients: number;
  recipes: number;
  components: number;
}

/** Imports (idempotently) the dataset's ingredients globally and its recipes for `userId`. */
export async function importDataset(
  prisma: PrismaClient,
  userId: string,
  dataset: Dataset,
): Promise<ImportSummary> {
  validateDataset(dataset);

  return prisma.$transaction(
    async (tx) => {
      const ingredientIdByExternal = new Map<string, string>();
      for (const ing of dataset.ingredients) {
        const row = await tx.ingredient.upsert({
          where: { externalId: ing.id },
          create: {
            externalId: ing.id,
            name: ing.name,
            defaultUnit: ing.unit ?? null,
            description: ing.description ?? null,
          },
          update: { name: ing.name, defaultUnit: ing.unit ?? null },
          select: { id: true },
        });
        ingredientIdByExternal.set(ing.id, row.id);
      }

      // Pass 1: create/update all recipes so that every reference can be resolved.
      const recipeIdByExternal = new Map<string, string>();
      for (const recipe of dataset.recipes) {
        const data = {
          name: recipe.name,
          category: recipe.category ?? null,
          description: recipe.description ?? null,
          servings: recipe.servings,
        };
        const row = await tx.recipe.upsert({
          where: { userId_externalId: { userId, externalId: recipe.id } },
          create: { ...data, userId, externalId: recipe.id },
          update: data,
          select: { id: true },
        });
        recipeIdByExternal.set(recipe.id, row.id);
      }

      // Pass 2: replace component lists.
      const recipeDbIds = [...recipeIdByExternal.values()];
      await tx.recipeComponent.deleteMany({ where: { recipeId: { in: recipeDbIds } } });

      const componentRows = dataset.recipes.flatMap((recipe) =>
        recipe.components.map((c, position) => ({
          recipeId: recipeIdByExternal.get(recipe.id) as string,
          position,
          quantity: c.quantity,
          unit: c.unit,
          ingredientId:
            c.type === 'ingredient'
              ? (ingredientIdByExternal.get(c.ingredient_id) as string)
              : null,
          childRecipeId:
            c.type === 'recipe' ? (recipeIdByExternal.get(c.recipe_id) as string) : null,
        })),
      );
      await tx.recipeComponent.createMany({ data: componentRows });

      return {
        ingredients: dataset.ingredients.length,
        recipes: dataset.recipes.length,
        components: componentRows.length,
      };
    },
    { timeout: 60_000 },
  );
}
