import {
  childScaleFactor,
  rootScaleFactor,
  roundQuantity,
  scaleIngredientQuantity,
} from './scaling';
import { RecipeData, RecipeGraph } from './types';

/** Hard limits that protect the server from pathological graphs. */
export const MAX_RECIPE_DEPTH = 100;
export const MAX_TREE_NODES = 10_000;

export interface IngredientTreeNode {
  type: 'ingredient';
  /** Stable key for the UI: the chain of component ids from the root. */
  key: string;
  componentId: string;
  ingredientId: string;
  name: string;
  /** Quantity required for the requested number of servings. */
  quantity: number;
  /** Quantity as written in the recipe (per one batch of the parent). */
  baseQuantity: number;
  unit: string;
}

export interface RecipeTreeNode {
  type: 'recipe';
  key: string;
  /** null for the root recipe. */
  componentId: string | null;
  recipeId: string;
  name: string;
  description: string | null;
  category: string | null;
  /** Servings one batch of this recipe yields. */
  servings: number;
  /** The quantity/unit used by the parent line (null for the root). */
  quantity: number | null;
  unit: string | null;
  /** Number of batches of this recipe required. */
  scaleFactor: number;
  /** Servings of this recipe that are produced (servings × scaleFactor). */
  yieldServings: number;
  depth: number;
  /** True when this node would re-enter a recipe already on the current path. */
  circular: boolean;
  children: TreeNode[];
}

export type TreeNode = IngredientTreeNode | RecipeTreeNode;

export class RecipeGraphError extends Error {}

interface BuildContext {
  graph: RecipeGraph;
  /** Recipes on the current root → node path (NOT a global visited set: a
   *  sub-recipe legitimately appears in several branches of the tree). */
  path: Set<string>;
  nodeCount: number;
}

/**
 * Builds the fully expanded, scaled composition tree of a recipe. The recursion
 * mirrors the data: a recipe node's children are its components, and recipe
 * components recurse. There is no fixed depth.
 */
export function buildRecipeTree(
  graph: RecipeGraph,
  rootId: string,
  targetServings?: number,
): RecipeTreeNode {
  const root = getRecipe(graph, rootId);
  const ctx: BuildContext = { graph, path: new Set(), nodeCount: 0 };
  return buildRecipeNode(ctx, root, {
    key: 'root',
    componentId: null,
    quantity: null,
    unit: null,
    factor: rootScaleFactor(root.servings, targetServings),
    depth: 0,
  });
}

interface NodePlacement {
  key: string;
  componentId: string | null;
  quantity: number | null;
  unit: string | null;
  factor: number;
  depth: number;
}

function buildRecipeNode(ctx: BuildContext, recipe: RecipeData, at: NodePlacement): RecipeTreeNode {
  countNode(ctx);
  if (at.depth > MAX_RECIPE_DEPTH) {
    throw new RecipeGraphError(`Recipe nesting exceeds the maximum depth of ${MAX_RECIPE_DEPTH}`);
  }

  const node: RecipeTreeNode = {
    type: 'recipe',
    key: at.key,
    componentId: at.componentId,
    recipeId: recipe.id,
    name: recipe.name,
    description: recipe.description,
    category: recipe.category,
    servings: recipe.servings,
    quantity: at.quantity,
    unit: at.unit,
    scaleFactor: roundQuantity(at.factor, 6),
    yieldServings: roundQuantity(recipe.servings * at.factor),
    depth: at.depth,
    circular: false,
    children: [],
  };

  if (ctx.path.has(recipe.id)) {
    // Defensive: the write path rejects cycles, but never expand one forever.
    node.circular = true;
    return node;
  }

  ctx.path.add(recipe.id);
  for (const component of sortByPosition(recipe.components)) {
    const key = `${at.key}/${component.id}`;
    if (component.type === 'ingredient') {
      countNode(ctx);
      node.children.push({
        type: 'ingredient',
        key,
        componentId: component.id,
        ingredientId: component.ingredientId,
        name: component.ingredientName,
        quantity: roundQuantity(scaleIngredientQuantity(component.quantity, at.factor)),
        baseQuantity: component.quantity,
        unit: component.unit,
      });
    } else {
      const child = getRecipe(ctx.graph, component.childRecipeId);
      node.children.push(
        buildRecipeNode(ctx, child, {
          key,
          componentId: component.id,
          quantity: component.quantity,
          unit: component.unit,
          factor: childScaleFactor(at.factor, component.quantity, component.unit, child.servings),
          depth: at.depth + 1,
        }),
      );
    }
  }
  ctx.path.delete(recipe.id);
  return node;
}

function countNode(ctx: BuildContext): void {
  ctx.nodeCount += 1;
  if (ctx.nodeCount > MAX_TREE_NODES) {
    throw new RecipeGraphError(`Recipe tree exceeds the maximum of ${MAX_TREE_NODES} nodes`);
  }
}

export function getRecipe(graph: RecipeGraph, id: string): RecipeData {
  const recipe = graph.get(id);
  if (!recipe) throw new RecipeGraphError(`Recipe ${id} is missing from the recipe graph`);
  return recipe;
}

export function sortByPosition<T extends { position: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position);
}
