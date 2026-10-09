import { z } from 'zod';
import { INGREDIENT_UNIT_CODES, RECIPE_COMPONENT_UNITS } from '../domain/units';
import {
  MAX_CATEGORY_LENGTH,
  MAX_COMPONENTS_PER_RECIPE,
  MAX_DESCRIPTION_LENGTH,
  MAX_SERVINGS,
  nameSchema,
  optionalTextSchema,
  quantitySchema,
  servingsSchema,
  uuidSchema,
} from './common';

const ingredientUnitSchema = z.enum(INGREDIENT_UNIT_CODES as [string, ...string[]], {
  message: `Unit must be one of: ${INGREDIENT_UNIT_CODES.join(', ')}`,
});

const recipeUnitSchema = z.enum(RECIPE_COMPONENT_UNITS, {
  message: `Unit for a recipe component must be one of: ${RECIPE_COMPONENT_UNITS.join(', ')}`,
});

export const ingredientComponentSchema = z.object({
  type: z.literal('ingredient'),
  ingredientId: uuidSchema,
  quantity: quantitySchema,
  unit: ingredientUnitSchema,
});

export const recipeComponentSchema = z.object({
  type: z.literal('recipe'),
  recipeId: uuidSchema,
  quantity: quantitySchema,
  unit: recipeUnitSchema.default('batch'),
});

/** A component in a create/add request: either an ingredient or a sub-recipe. */
export const componentInputSchema = z.discriminatedUnion(
  'type',
  [ingredientComponentSchema, recipeComponentSchema],
  { message: 'Component type must be "ingredient" or "recipe"' },
);

/**
 * In a full recipe update a component may carry the `id` of an existing
 * component; it is then updated in place instead of recreated.
 */
export const componentSyncSchema = z.discriminatedUnion(
  'type',
  [
    ingredientComponentSchema.extend({ id: uuidSchema.optional() }),
    recipeComponentSchema.extend({ id: uuidSchema.optional() }),
  ],
  { message: 'Component type must be "ingredient" or "recipe"' },
);

const componentsArray = <T extends z.ZodTypeAny>(item: T) =>
  z
    .array(item)
    .max(
      MAX_COMPONENTS_PER_RECIPE,
      `A recipe can have at most ${MAX_COMPONENTS_PER_RECIPE} components`,
    );

export const createRecipeSchema = z.object({
  name: nameSchema,
  description: optionalTextSchema(MAX_DESCRIPTION_LENGTH),
  category: optionalTextSchema(MAX_CATEGORY_LENGTH),
  servings: servingsSchema,
  components: componentsArray(componentInputSchema).default([]),
});

export const updateRecipeSchema = z
  .object({
    name: nameSchema.optional(),
    description: optionalTextSchema(MAX_DESCRIPTION_LENGTH).optional(),
    category: optionalTextSchema(MAX_CATEGORY_LENGTH).optional(),
    servings: servingsSchema.optional(),
    /** When present, replaces the recipe's component list (ordered). */
    components: componentsArray(componentSyncSchema).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Provide at least one field to update',
  });

/** Partial update of one component; its type/target can't change. */
export const updateComponentSchema = z
  .object({
    quantity: quantitySchema.optional(),
    unit: z.string().trim().min(1).optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Provide quantity, unit or position to update',
  });

export const reorderComponentsSchema = z.object({
  componentIds: z.array(uuidSchema).min(1, 'componentIds must not be empty'),
});

export const listRecipesQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(MAX_CATEGORY_LENGTH * 2)
    .optional(),
  category: z.string().trim().max(MAX_CATEGORY_LENGTH).optional(),
  sort: z.enum(['updated', 'created', 'name']).default('updated'),
});

export const duplicateRecipeSchema = z.object({
  name: nameSchema.optional(),
});

export const shoppingListSchema = z.object({
  items: z
    .array(
      z.object({
        recipeId: uuidSchema,
        servings: z
          .number()
          .positive()
          .max(MAX_SERVINGS * 100)
          .optional(),
      }),
    )
    .min(1, 'Add at least one recipe to the shopping list')
    .max(50),
});

export type ComponentInput = z.infer<typeof componentInputSchema>;
export type ComponentSyncInput = z.infer<typeof componentSyncSchema>;
export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;
export type UpdateComponentInput = z.infer<typeof updateComponentSchema>;
export type ListRecipesQuery = z.infer<typeof listRecipesQuerySchema>;
export type ShoppingListInput = z.infer<typeof shoppingListSchema>;
