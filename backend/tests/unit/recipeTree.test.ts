import { describe, expect, it } from 'vitest';
import {
  buildRecipeTree,
  MAX_RECIPE_DEPTH,
  RecipeGraphError,
  RecipeTreeNode,
  TreeNode,
} from '../../src/domain/recipeTree';
import { graphOf, ing, recipe, sub } from './graphBuilders';

const recipeChild = (node: RecipeTreeNode, index: number) => node.children[index] as RecipeTreeNode;

function depthOf(node: TreeNode): number {
  return node.type === 'ingredient' ? 0 : 1 + Math.max(0, ...node.children.map(depthOf));
}

describe('buildRecipeTree', () => {
  const lasagnaGraph = graphOf(
    recipe('Tomato Sauce', 4, [
      ing('Tomatoes', 500),
      ing('Garlic', 20),
      ing('Olive Oil', 30, 'ml'),
    ]),
    recipe('Bolognese Sauce', 4, [ing('Minced Meat', 400), sub('Tomato Sauce')]),
    recipe('Lasagna', 4, [ing('Pasta Sheets', 300), sub('Bolognese Sauce'), ing('Cheese', 200)]),
  );

  it('builds the nested Lasagna structure from the specification', () => {
    const tree = buildRecipeTree(lasagnaGraph, 'Lasagna');
    expect(tree.name).toBe('Lasagna');
    expect(tree.children.map((c) => `${c.type}:${c.name}`)).toEqual([
      'ingredient:Pasta Sheets',
      'recipe:Bolognese Sauce',
      'ingredient:Cheese',
    ]);
    const bolognese = recipeChild(tree, 1);
    const tomato = recipeChild(bolognese, 1);
    expect(tomato.name).toBe('Tomato Sauce');
    expect(tomato.depth).toBe(2);
    expect(tomato.children.map((c) => c.name)).toEqual(['Tomatoes', 'Garlic', 'Olive Oil']);
  });

  it('gives every node a unique, stable key', () => {
    const keys: string[] = [];
    const walk = (n: TreeNode) => {
      keys.push(n.key);
      if (n.type === 'recipe') n.children.forEach(walk);
    };
    walk(buildRecipeTree(lasagnaGraph, 'Lasagna'));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('scales quantities throughout the tree for a target number of servings', () => {
    const tree = buildRecipeTree(lasagnaGraph, 'Lasagna', 8);
    expect(tree.scaleFactor).toBe(2);
    expect(tree.yieldServings).toBe(8);
    expect(tree.children[0]).toMatchObject({
      name: 'Pasta Sheets',
      quantity: 600,
      baseQuantity: 300,
    });
    const tomato = recipeChild(recipeChild(tree, 1), 1);
    expect(tomato.scaleFactor).toBe(2);
    expect(tomato.children[0]).toMatchObject({ name: 'Tomatoes', quantity: 1000 });
  });

  it('applies serving-based component scaling to nested nodes', () => {
    const graph = graphOf(
      recipe('Tomato Sauce', 4, [ing('Tomatoes', 500)]),
      recipe('Pasta', 2, [sub('Tomato Sauce', 8, 'serving')]),
    );
    const sauce = recipeChild(buildRecipeTree(graph, 'Pasta'), 0);
    expect(sauce).toMatchObject({ quantity: 8, unit: 'serving', scaleFactor: 2, yieldServings: 8 });
    expect(sauce.children[0]).toMatchObject({ quantity: 1000 });
  });

  it('supports arbitrary nesting depth (A → B → C → D → E and deeper)', () => {
    const depth = 60;
    const recipes = [recipe('R0', 1, [ing('Salt', 1)])];
    for (let i = 1; i <= depth; i += 1) recipes.push(recipe(`R${i}`, 1, [sub(`R${i - 1}`)]));
    const tree = buildRecipeTree(graphOf(...recipes), `R${depth}`);
    expect(depthOf(tree)).toBe(depth + 1);
  });

  it('respects component positions', () => {
    const r = recipe('X', 1, [ing('B', 1), ing('A', 1)]);
    r.components = [
      { ...(r.components[0] as (typeof r.components)[number]), position: 1 },
      { ...(r.components[1] as (typeof r.components)[number]), position: 0 },
    ];
    expect(buildRecipeTree(graphOf(r), 'X').children.map((c) => c.name)).toEqual(['A', 'B']);
  });

  it('marks (and does not expand) a circular reference instead of recursing forever', () => {
    const graph = graphOf(recipe('A', 1, [sub('B')]), recipe('B', 1, [sub('A')]));
    const tree = buildRecipeTree(graph, 'A');
    const repeated = recipeChild(recipeChild(tree, 0), 0);
    expect(repeated).toMatchObject({ name: 'A', circular: true, children: [] });
  });

  it('rejects trees deeper than the safety limit', () => {
    const recipes = [recipe('R0', 1, [])];
    for (let i = 1; i <= MAX_RECIPE_DEPTH + 1; i += 1)
      recipes.push(recipe(`R${i}`, 1, [sub(`R${i - 1}`)]));
    expect(() => buildRecipeTree(graphOf(...recipes), `R${MAX_RECIPE_DEPTH + 1}`)).toThrow(
      RecipeGraphError,
    );
  });

  it('rejects unknown recipe ids', () => {
    expect(() => buildRecipeTree(graphOf(), 'missing')).toThrow(RecipeGraphError);
  });
});
