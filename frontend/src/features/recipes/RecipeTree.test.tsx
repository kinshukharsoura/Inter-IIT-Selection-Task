import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { IngredientTreeNode, RecipeTreeNode, TreeNode } from '../../api/types';
import { RecipeTree } from './RecipeTree';
import { collectRecipeKeys, treeStats } from './treeUtils';

function ingredient(
  key: string,
  name: string,
  quantity: number,
  unit = 'g',
  baseQuantity = quantity,
): IngredientTreeNode {
  return {
    type: 'ingredient',
    key,
    componentId: key,
    ingredientId: `ing-${name}`,
    name,
    quantity,
    baseQuantity,
    unit,
  };
}

function recipe(
  key: string,
  name: string,
  depth: number,
  children: TreeNode[],
  extra: Partial<RecipeTreeNode> = {},
): RecipeTreeNode {
  return {
    type: 'recipe',
    key,
    componentId: depth === 0 ? null : key,
    recipeId: `id-${name}`,
    name,
    description: null,
    category: null,
    servings: 4,
    quantity: depth === 0 ? null : 1,
    unit: depth === 0 ? null : 'batch',
    scaleFactor: 1,
    yieldServings: 4,
    depth,
    circular: false,
    children,
    ...extra,
  };
}

/** Lasagna → Bolognese Sauce → Tomato Sauce, as in the task specification. */
const lasagna = recipe('root', 'Lasagna', 0, [
  ingredient('root/1', 'Pasta Sheets', 300),
  recipe('root/2', 'Bolognese Sauce', 1, [
    ingredient('root/2/1', 'Minced Meat', 400),
    recipe(
      'root/2/2',
      'Tomato Sauce',
      2,
      [
        ingredient('root/2/2/1', 'Tomatoes', 1000, 'g', 500),
        ingredient('root/2/2/2', 'Garlic', 20),
        ingredient('root/2/2/3', 'Olive Oil', 30, 'ml'),
      ],
      { scaleFactor: 2, yieldServings: 8 },
    ),
  ]),
  ingredient('root/3', 'Cheese', 200),
]);

/** A → B → C → … with `depth` nested recipes. */
function chain(depth: number): RecipeTreeNode {
  let node: RecipeTreeNode = recipe(`n${depth}`, `Recipe ${depth}`, depth, [
    ingredient(`n${depth}/salt`, 'Salt', 1),
  ]);
  for (let d = depth - 1; d >= 0; d -= 1) node = recipe(`n${d}`, `Recipe ${d}`, d, [node]);
  return node;
}

const renderTree = (root: RecipeTreeNode) =>
  render(
    <MemoryRouter>
      <RecipeTree root={root} />
    </MemoryRouter>,
  );

describe('RecipeTree', () => {
  it('expands the first two recipe levels by default', () => {
    renderTree(lasagna);
    expect(screen.getByText('Pasta Sheets')).toBeInTheDocument();
    expect(screen.getByText('Minced Meat')).toBeInTheDocument();
    expect(screen.getByText('Tomato Sauce')).toBeInTheDocument();
    // Tomato Sauce is at depth 2, so its ingredients are collapsed initially.
    expect(screen.queryByText('Tomatoes')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand Tomato Sauce' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('expands and collapses a nested recipe with its toggle button', async () => {
    const user = userEvent.setup();
    renderTree(lasagna);
    await user.click(screen.getByRole('button', { name: 'Expand Tomato Sauce' }));
    expect(screen.getByText('Tomatoes')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Collapse Tomato Sauce' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      document.getElementById(toggle.getAttribute('aria-controls') as string),
    ).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByText('Tomatoes')).not.toBeInTheDocument();
  });

  it('supports keyboard expand/collapse with arrow keys', async () => {
    const user = userEvent.setup();
    renderTree(lasagna);
    screen.getByRole('button', { name: 'Expand Tomato Sauce' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('Garlic')).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(screen.queryByText('Garlic')).not.toBeInTheDocument();
  });

  it('distinguishes ingredients from recipes and shows quantities and units', async () => {
    const user = userEvent.setup();
    renderTree(lasagna);
    await user.click(screen.getByRole('button', { name: 'Expand all' }));

    expect(screen.getAllByText('Recipe')).toHaveLength(3);
    expect(screen.getAllByText('Ingredient')).toHaveLength(6);
    expect(screen.getByText('300 g')).toBeInTheDocument();
    expect(screen.getByText('30 ml')).toBeInTheDocument();
    // Scaled ingredient shows the scaled amount and the amount written in the recipe.
    const tomatoes = screen.getByText('Tomatoes').closest('li') as HTMLElement;
    expect(within(tomatoes).getByText(/1,?000 g/)).toBeInTheDocument();
    expect(within(tomatoes).getByText('recipe: 500 g')).toBeInTheDocument();
    expect(screen.getByText(/×2 batch/)).toBeInTheDocument();
  });

  it('links nested recipes to their own page', () => {
    renderTree(lasagna);
    expect(screen.getByRole('link', { name: 'Open recipe Bolognese Sauce' })).toHaveAttribute(
      'href',
      '/recipes/id-Bolognese Sauce',
    );
    expect(screen.queryByRole('link', { name: 'Open recipe Lasagna' })).not.toBeInTheDocument();
  });

  it('renders arbitrarily deep nesting recursively (Expand all / Collapse all)', async () => {
    const user = userEvent.setup();
    const depth = 25;
    renderTree(chain(depth));
    expect(screen.queryByText(`Recipe ${depth}`)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getByText(`Recipe ${depth}`)).toBeInTheDocument();
    expect(screen.getByText('Salt')).toBeInTheDocument();
    expect(
      screen.getByText(`${depth} nested recipes · 1 ingredient line · ${depth + 1} levels deep`),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(screen.getByText('Recipe 1')).toBeInTheDocument();
    expect(screen.queryByText('Recipe 2')).not.toBeInTheDocument();
  });

  it('flags circular references instead of expanding them', () => {
    const root = recipe('root', 'A', 0, [recipe('root/1', 'A', 1, [], { circular: true })]);
    renderTree(root);
    expect(screen.getByText(/Circular reference/)).toBeInTheDocument();
  });
});

describe('tree utilities', () => {
  it('collects recipe keys up to a depth', () => {
    expect(collectRecipeKeys(lasagna)).toEqual(['root', 'root/2', 'root/2/2']);
    expect(collectRecipeKeys(lasagna, 2)).toEqual(['root', 'root/2']);
  });

  it('computes tree statistics', () => {
    expect(treeStats(lasagna)).toEqual({ recipes: 3, ingredients: 6, depth: 2 });
  });
});
