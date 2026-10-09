import { describe, expect, it } from 'vitest';
import { computeCombinedTotals, computeIngredientTotals } from '../../src/domain/ingredientTotals';
import { RecipeGraphError } from '../../src/domain/recipeTree';
import { graphOf, ing, recipe, sub } from './graphBuilders';

const asRecord = (totals: { name: string; quantity: number; unit: string }[]) =>
  Object.fromEntries(totals.map((t) => [`${t.name} (${t.unit})`, t.quantity]));

describe('computeIngredientTotals', () => {
  it('Recipe A = 2 × Recipe B (100 g Flour) requires 200 g Flour', () => {
    const graph = graphOf(recipe('B', 1, [ing('Flour', 100)]), recipe('A', 1, [sub('B', 2)]));
    expect(asRecord(computeIngredientTotals(graph, 'A'))).toEqual({ 'Flour (g)': 200 });
  });

  it('expands the Pizza example from the task specification', () => {
    const graph = graphOf(
      recipe('Pizza Dough', 1, [ing('Flour', 300), ing('Water', 200, 'ml'), ing('Yeast', 5)]),
      recipe('Pizza Sauce', 1, [ing('Tomatoes', 200), ing('Garlic', 10)]),
      recipe('Pizza', 1, [sub('Pizza Dough'), sub('Pizza Sauce'), ing('Cheese', 150)]),
    );
    expect(asRecord(computeIngredientTotals(graph, 'Pizza'))).toEqual({
      'Cheese (g)': 150,
      'Flour (g)': 300,
      'Garlic (g)': 10,
      'Tomatoes (g)': 200,
      'Water (ml)': 200,
      'Yeast (g)': 5,
    });
  });

  it('scales by servings: 8 servings of a 4-serving Tomato Sauce (500 g) needs 1000 g', () => {
    const graph = graphOf(
      recipe('Tomato Sauce', 4, [ing('Tomatoes', 500)]),
      recipe('Big Pasta', 8, [sub('Tomato Sauce', 8, 'serving')]),
    );
    expect(asRecord(computeIngredientTotals(graph, 'Big Pasta'))).toEqual({ 'Tomatoes (g)': 1000 });
  });

  it('scales the root recipe to a target number of servings', () => {
    const graph = graphOf(recipe('Tomato Sauce', 4, [ing('Tomatoes', 500)]));
    expect(asRecord(computeIngredientTotals(graph, 'Tomato Sauce', 8))).toEqual({
      'Tomatoes (g)': 1000,
    });
    expect(asRecord(computeIngredientTotals(graph, 'Tomato Sauce', 2))).toEqual({
      'Tomatoes (g)': 250,
    });
  });

  it('propagates scale factors through arbitrary nesting A → B → C → D → E', () => {
    const graph = graphOf(
      recipe('E', 1, [ing('Salt', 1)]),
      recipe('D', 1, [sub('E', 2), ing('Pepper', 1)]),
      recipe('C', 1, [sub('D', 3)]),
      recipe('B', 1, [sub('C', 2)]),
      recipe('A', 1, [sub('B', 1)]),
    );
    // Salt: 1 × 2 × 3 × 2 × 1 = 12; Pepper: 1 × 3 × 2 × 1 = 6
    expect(asRecord(computeIngredientTotals(graph, 'A'))).toEqual({
      'Salt (g)': 12,
      'Pepper (g)': 6,
    });
  });

  it('combines nested serving-based and batch-based scaling', () => {
    const graph = graphOf(
      recipe('Stock', 10, [ing('Water', 1000, 'ml')]),
      recipe('Soup', 4, [sub('Stock', 5, 'serving'), ing('Carrot', 2, 'piece')]),
      recipe('Dinner', 2, [sub('Soup', 2, 'batch')]),
    );
    // Dinner for 4 servings → factor 2 → Soup 4 batches → Stock 4 × 5/10 = 2 batches
    expect(asRecord(computeIngredientTotals(graph, 'Dinner', 4))).toEqual({
      'Water (ml)': 2000,
      'Carrot (piece)': 8,
    });
  });

  it('aggregates the same ingredient from different branches and converts units', () => {
    const graph = graphOf(
      recipe('Dough', 1, [ing('Flour', 1, 'kg')]),
      recipe('Roux', 1, [ing('Flour', 50), ing('Milk', 0.5, 'l')]),
      recipe('Dish', 1, [sub('Dough'), sub('Roux'), ing('Flour', 250), ing('Milk', 2, 'tbsp')]),
    );
    expect(asRecord(computeIngredientTotals(graph, 'Dish'))).toEqual({
      'Flour (g)': 1300,
      'Milk (ml)': 530,
    });
  });

  it('keeps non-convertible units as separate lines', () => {
    const graph = graphOf(recipe('X', 1, [ing('Garlic', 2, 'clove'), ing('Garlic', 10, 'g')]));
    expect(asRecord(computeIngredientTotals(graph, 'X'))).toEqual({
      'Garlic (clove)': 2,
      'Garlic (g)': 10,
    });
  });

  it('counts a sub-recipe reused in several branches every time it is used', () => {
    const graph = graphOf(
      recipe('Sauce', 1, [ing('Tomatoes', 100)]),
      recipe('Pizza', 1, [sub('Sauce')]),
      recipe('Pasta', 1, [sub('Sauce', 2)]),
      recipe('Feast', 1, [sub('Pizza'), sub('Pasta'), sub('Sauce')]),
    );
    expect(asRecord(computeIngredientTotals(graph, 'Feast'))).toEqual({ 'Tomatoes (g)': 400 });
  });

  it('handles exponential DAG reuse efficiently via memoisation', () => {
    // Each level uses the level below twice: tree size 2^40, DAG size 41.
    const levels = 40;
    const recipes = [recipe('L0', 1, [ing('Salt', 1)])];
    for (let i = 1; i <= levels; i += 1)
      recipes.push(recipe(`L${i}`, 1, [sub(`L${i - 1}`), sub(`L${i - 1}`)]));
    const [total] = computeIngredientTotals(graphOf(...recipes), `L${levels}`);
    expect(total?.quantity).toBe(2 ** levels);
  });

  it('returns an empty list for a recipe without components', () => {
    expect(computeIngredientTotals(graphOf(recipe('Empty', 1, [])), 'Empty')).toEqual([]);
  });

  it('throws instead of looping forever on a cyclic graph', () => {
    const graph = graphOf(recipe('A', 1, [sub('B')]), recipe('B', 1, [sub('A')]));
    expect(() => computeIngredientTotals(graph, 'A')).toThrow(RecipeGraphError);
  });
});

describe('computeCombinedTotals (shopping list)', () => {
  it('sums several recipes scaled to their own servings', () => {
    const graph = graphOf(
      recipe('Sauce', 4, [ing('Tomatoes', 400)]),
      recipe('Bread', 2, [ing('Flour', 500)]),
    );
    const totals = computeCombinedTotals(graph, [
      { recipeId: 'Sauce', servings: 2 },
      { recipeId: 'Bread' },
      { recipeId: 'Sauce', servings: 4 },
    ]);
    expect(asRecord(totals)).toEqual({ 'Tomatoes (g)': 600, 'Flour (g)': 500 });
  });
});
