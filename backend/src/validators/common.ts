import { z } from 'zod';

export const MAX_NAME_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_CATEGORY_LENGTH = 60;
export const MAX_SERVINGS = 1000;
export const MAX_QUANTITY = 1_000_000;
export const MAX_COMPONENTS_PER_RECIPE = 200;

export const uuidSchema = z.uuid({ message: 'Must be a valid id' });

export const idParamSchema = z.object({ id: uuidSchema });
export const componentParamSchema = z.object({ id: uuidSchema, componentId: uuidSchema });

export const nameSchema = z
  .string({ message: 'Name is required' })
  .trim()
  .min(1, 'Name is required')
  .max(MAX_NAME_LENGTH, `Name must be at most ${MAX_NAME_LENGTH} characters`);

/** Optional free text; empty strings are stored as null. */
export const optionalTextSchema = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .nullish()
    .transform((v) => (v ? v : null));

export const servingsSchema = z
  .number({ message: 'Servings must be a number' })
  .int('Servings must be a whole number')
  .min(1, 'Servings must be at least 1')
  .max(MAX_SERVINGS, `Servings must be at most ${MAX_SERVINGS}`);

export const quantitySchema = z
  .number({ message: 'Quantity must be a number' })
  .positive('Quantity must be greater than 0')
  .max(MAX_QUANTITY, `Quantity must be at most ${MAX_QUANTITY}`);

/** `?servings=8` on read endpoints that scale a recipe. */
export const scaleQuerySchema = z.object({
  servings: z.coerce
    .number({ message: 'servings must be a number' })
    .positive('servings must be greater than 0')
    .max(MAX_SERVINGS * 100)
    .optional(),
});
