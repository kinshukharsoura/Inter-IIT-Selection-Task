import { z } from 'zod';
import { INGREDIENT_UNIT_CODES } from '../domain/units';
import { MAX_DESCRIPTION_LENGTH, nameSchema, optionalTextSchema } from './common';

const defaultUnitSchema = z
  .enum(INGREDIENT_UNIT_CODES as [string, ...string[]], {
    message: `Unit must be one of: ${INGREDIENT_UNIT_CODES.join(', ')}`,
  })
  .nullish()
  .transform((v) => v ?? null);

export const createIngredientSchema = z.object({
  name: nameSchema,
  description: optionalTextSchema(MAX_DESCRIPTION_LENGTH),
  defaultUnit: defaultUnitSchema,
});

export const updateIngredientSchema = z
  .object({
    name: nameSchema.optional(),
    description: optionalTextSchema(MAX_DESCRIPTION_LENGTH).optional(),
    defaultUnit: defaultUnitSchema.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Provide at least one field to update',
  });

export const listIngredientsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

export type CreateIngredientInput = z.infer<typeof createIngredientSchema>;
export type UpdateIngredientInput = z.infer<typeof updateIngredientSchema>;
