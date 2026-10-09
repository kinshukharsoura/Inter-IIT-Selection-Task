/**
 * Measurement units supported for ingredient components.
 *
 * Units of the same dimension (mass / volume) are converted to a common base unit
 * when ingredient totals are aggregated, so "1 kg Flour" + "300 g Flour" = "1300 g Flour".
 * Count-like units (piece, pinch, ...) cannot be converted and are aggregated as-is.
 */
export type UnitDimension = 'mass' | 'volume' | 'count';

export interface UnitDefinition {
  code: string;
  label: string;
  dimension: UnitDimension;
  /** Multiplier to the dimension's base unit; null for non-convertible units. */
  toBase: number | null;
}

export const UNITS: readonly UnitDefinition[] = [
  { code: 'mg', label: 'milligram', dimension: 'mass', toBase: 0.001 },
  { code: 'g', label: 'gram', dimension: 'mass', toBase: 1 },
  { code: 'kg', label: 'kilogram', dimension: 'mass', toBase: 1000 },
  { code: 'ml', label: 'millilitre', dimension: 'volume', toBase: 1 },
  { code: 'l', label: 'litre', dimension: 'volume', toBase: 1000 },
  { code: 'tsp', label: 'teaspoon', dimension: 'volume', toBase: 5 },
  { code: 'tbsp', label: 'tablespoon', dimension: 'volume', toBase: 15 },
  { code: 'cup', label: 'cup', dimension: 'volume', toBase: 240 },
  { code: 'piece', label: 'piece', dimension: 'count', toBase: null },
  { code: 'clove', label: 'clove', dimension: 'count', toBase: null },
  { code: 'slice', label: 'slice', dimension: 'count', toBase: null },
  { code: 'pinch', label: 'pinch', dimension: 'count', toBase: null },
  { code: 'bunch', label: 'bunch', dimension: 'count', toBase: null },
] as const;

export const BASE_UNIT: Record<Exclude<UnitDimension, 'count'>, string> = {
  mass: 'g',
  volume: 'ml',
};

export const INGREDIENT_UNIT_CODES = UNITS.map((u) => u.code);

/** Units for a component that references another recipe. */
export const RECIPE_COMPONENT_UNITS = ['batch', 'serving'] as const;
export type RecipeComponentUnit = (typeof RECIPE_COMPONENT_UNITS)[number];

const UNIT_BY_CODE = new Map(UNITS.map((u) => [u.code, u]));

export function isIngredientUnit(code: string): boolean {
  return UNIT_BY_CODE.has(code);
}

export function isRecipeComponentUnit(code: string): code is RecipeComponentUnit {
  return (RECIPE_COMPONENT_UNITS as readonly string[]).includes(code);
}

/**
 * Converts a quantity to its dimension's base unit (g or ml). Non-convertible or
 * unknown units are returned unchanged so that no data is silently lost.
 */
export function toBaseUnit(quantity: number, unit: string): { quantity: number; unit: string } {
  const def = UNIT_BY_CODE.get(unit);
  if (!def || def.toBase === null || def.dimension === 'count') {
    return { quantity, unit };
  }
  return { quantity: quantity * def.toBase, unit: BASE_UNIT[def.dimension] };
}
