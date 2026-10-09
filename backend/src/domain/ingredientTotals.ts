import { getRecipe, MAX_RECIPE_DEPTH, RecipeGraphError } from './recipeTree';
import { childScaleFactor, rootScaleFactor, roundQuantity } from './scaling';
import { RecipeGraph } from './types';
import { toBaseUnit } from './units';

export interface IngredientTotal {
  ingredientId: string;
  name: string;
  quantity: number;
  unit: string;
}

/** Totals for ONE batch of a recipe, keyed by `${ingredientId}|${baseUnit}`. */
type TotalsVector = Map<string, IngredientTotal>;

/**
 * Computes the complete raw-ingredient requirements of a recipe by recursively
 * expanding every nested recipe and propagating scale factors.
 *
 * The graph is a DAG in which the same sub-recipe can be reused many times
 * (Tomato Sauce inside Bolognese inside Lasagna, and also inside Pizza Sauce...).
 * Expanding it as a tree can be exponential, so totals are computed with
 * memoised post-order DFS: each recipe's per-batch totals are computed exactly
 * once (O(V + E)) and reused, scaled, wherever the recipe appears.
 *
 * Quantities of the same ingredient are summed after converting to a base unit
 * (g / ml); non-convertible units (piece, pinch...) are kept as separate lines.
 */
export function computeIngredientTotals(
  graph: RecipeGraph,
  rootId: string,
  targetServings?: number,
): IngredientTotal[] {
  const root = getRecipe(graph, rootId);
  const memo = new Map<string, TotalsVector>();
  const onPath = new Set<string>();
  const perBatch = totalsPerBatch(graph, rootId, memo, onPath, 0);
  const factor = rootScaleFactor(root.servings, targetServings);
  return finalize(scaleVector(perBatch, factor));
}

/** Aggregates the totals of several (recipe, servings) requests — e.g. a shopping list. */
export function computeCombinedTotals(
  graph: RecipeGraph,
  requests: readonly { recipeId: string; servings?: number }[],
): IngredientTotal[] {
  const memo = new Map<string, TotalsVector>();
  const combined: TotalsVector = new Map();
  for (const request of requests) {
    const recipe = getRecipe(graph, request.recipeId);
    const perBatch = totalsPerBatch(graph, request.recipeId, memo, new Set(), 0);
    addInto(combined, perBatch, rootScaleFactor(recipe.servings, request.servings));
  }
  return finalize(combined);
}

function totalsPerBatch(
  graph: RecipeGraph,
  recipeId: string,
  memo: Map<string, TotalsVector>,
  onPath: Set<string>,
  depth: number,
): TotalsVector {
  const cached = memo.get(recipeId);
  if (cached) return cached;
  if (onPath.has(recipeId)) {
    throw new RecipeGraphError('Circular recipe dependency detected while expanding ingredients');
  }
  if (depth > MAX_RECIPE_DEPTH) {
    throw new RecipeGraphError(`Recipe nesting exceeds the maximum depth of ${MAX_RECIPE_DEPTH}`);
  }

  onPath.add(recipeId);
  const recipe = getRecipe(graph, recipeId);
  const totals: TotalsVector = new Map();

  for (const component of recipe.components) {
    if (component.type === 'ingredient') {
      const base = toBaseUnit(component.quantity, component.unit);
      addLine(totals, {
        ingredientId: component.ingredientId,
        name: component.ingredientName,
        quantity: base.quantity,
        unit: base.unit,
      });
    } else {
      const child = getRecipe(graph, component.childRecipeId);
      const childTotals = totalsPerBatch(graph, child.id, memo, onPath, depth + 1);
      addInto(
        totals,
        childTotals,
        childScaleFactor(1, component.quantity, component.unit, child.servings),
      );
    }
  }

  onPath.delete(recipeId);
  memo.set(recipeId, totals);
  return totals;
}

function addLine(target: TotalsVector, line: IngredientTotal): void {
  const key = `${line.ingredientId}|${line.unit}`;
  const existing = target.get(key);
  if (existing) existing.quantity += line.quantity;
  else target.set(key, { ...line });
}

function addInto(target: TotalsVector, source: TotalsVector, factor: number): void {
  for (const line of source.values())
    addLine(target, { ...line, quantity: line.quantity * factor });
}

function scaleVector(source: TotalsVector, factor: number): TotalsVector {
  const result: TotalsVector = new Map();
  addInto(result, source, factor);
  return result;
}

function finalize(totals: TotalsVector): IngredientTotal[] {
  return [...totals.values()]
    .map((line) => ({ ...line, quantity: roundQuantity(line.quantity) }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.unit.localeCompare(b.unit));
}
