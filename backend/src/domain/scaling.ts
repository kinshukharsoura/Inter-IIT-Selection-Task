import { RecipeComponentUnit } from './units';

/**
 * Serving-size scaling rules.
 *
 * Every recipe yields `servings` servings per batch. All quantities stored on a
 * recipe's components are "per one batch". A *scale factor* says how many
 * batches of a recipe are needed:
 *
 *   - Root recipe viewed for `targetServings`:   factor = targetServings / recipe.servings
 *   - Ingredient line:                            required = line.quantity × factor
 *   - Sub-recipe line with unit "batch":          childFactor = factor × line.quantity
 *   - Sub-recipe line with unit "serving":        childFactor = factor × line.quantity / child.servings
 *
 * Example: Tomato Sauce yields 4 servings and contains 500 g Tomatoes.
 * A parent that uses "8 serving" of it needs 8 / 4 = 2 batches → 1000 g Tomatoes.
 */

export function rootScaleFactor(recipeServings: number, targetServings?: number): number {
  if (targetServings === undefined) return 1;
  assertPositive(recipeServings, 'recipe servings');
  assertPositive(targetServings, 'target servings');
  return targetServings / recipeServings;
}

export function childScaleFactor(
  parentFactor: number,
  quantity: number,
  unit: RecipeComponentUnit | string,
  childServings: number,
): number {
  if (unit === 'serving') {
    assertPositive(childServings, 'child recipe servings');
    return (parentFactor * quantity) / childServings;
  }
  // "batch" (also the fallback for legacy rows without a recipe unit).
  return parentFactor * quantity;
}

export function scaleIngredientQuantity(quantity: number, factor: number): number {
  return quantity * factor;
}

/** Rounds away floating-point noise (e.g. 0.30000000000000004) for presentation. */
export function roundQuantity(value: number, decimals = 3): number {
  const p = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * p) / p;
}

function assertPositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive number`);
  }
}
