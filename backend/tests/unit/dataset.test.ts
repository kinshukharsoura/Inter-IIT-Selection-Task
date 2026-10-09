import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeIngredientTotals } from '../../src/domain/ingredientTotals';
import { buildRecipeTree } from '../../src/domain/recipeTree';
import { ComponentData, RecipeData } from '../../src/domain/types';
import { Dataset, readDatasetFromDir, validateDataset } from '../../src/scripts/importDataset';

const dataset = readDatasetFromDir(path.resolve(__dirname, '../../prisma/data'));

/** Builds a domain graph straight from the dataset (no database). */
function graphFromDataset(data: Dataset): Map<string, RecipeData> {
  const ingredientNames = new Map(data.ingredients.map((i) => [i.id, i.name]));
  return new Map(
    data.recipes.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        description: r.description ?? null,
        category: r.category ?? null,
        servings: r.servings,
        components: r.components.map((c, position): ComponentData =>
          c.type === 'ingredient'
            ? {
                id: `${r.id}-${position}`,
                type: 'ingredient',
                position,
                quantity: c.quantity,
                unit: c.unit,
                ingredientId: c.ingredient_id,
                ingredientName: ingredientNames.get(c.ingredient_id) ?? c.ingredient_id,
              }
            : {
                id: `${r.id}-${position}`,
                type: 'recipe',
                position,
                quantity: c.quantity,
                unit: c.unit,
                childRecipeId: c.recipe_id,
              },
        ),
      },
    ]),
  );
}

describe('provided dataset', () => {
  it('is structurally valid: references resolve, units are supported, no cycles', () => {
    expect(() => validateDataset(dataset)).not.toThrow();
    expect(dataset.recipes.length).toBeGreaterThan(0);
    expect(dataset.ingredients.length).toBeGreaterThan(0);
  });

  it('every recipe can be expanded into a tree and ingredient totals', () => {
    const graph = graphFromDataset(dataset);
    for (const r of dataset.recipes) {
      expect(() => buildRecipeTree(graph, r.id)).not.toThrow();
      expect(computeIngredientTotals(graph, r.id).length).toBeGreaterThan(0);
    }
  });

  it('expands Pizza Sauce = Tomato Sauce (1 batch) + own ingredients', () => {
    const totals = computeIngredientTotals(graphFromDataset(dataset), 'recipe_pizza_sauce');
    const byName = Object.fromEntries(totals.map((t) => [t.name, t.quantity]));
    // Tomato Sauce: 50 g Tomatoes, 20 g Garlic, 10 g Onion; Pizza Sauce adds 300 g Oregano, 5 g Paprika.
    expect(byName).toMatchObject({ Tomatoes: 50, Garlic: 20, Onion: 10, Oregano: 300, Paprika: 5 });
  });

  it('rejects a dataset that contains a cycle', () => {
    const broken: Dataset = {
      ingredients: [],
      recipes: [
        {
          id: 'a',
          name: 'A',
          servings: 1,
          components: [{ type: 'recipe', recipe_id: 'b', quantity: 1, unit: 'batch' }],
        },
        {
          id: 'b',
          name: 'B',
          servings: 1,
          components: [{ type: 'recipe', recipe_id: 'a', quantity: 1, unit: 'batch' }],
        },
      ],
    };
    expect(() => validateDataset(broken)).toThrow(/circular dependency/);
  });

  it('rejects dangling references', () => {
    const broken: Dataset = {
      ingredients: [],
      recipes: [
        {
          id: 'a',
          name: 'A',
          servings: 1,
          components: [{ type: 'ingredient', ingredient_id: 'nope', quantity: 1, unit: 'g' }],
        },
      ],
    };
    expect(() => validateDataset(broken)).toThrow(/unknown ingredient/);
  });
});
