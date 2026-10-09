import type { RecipeTreeNode, TreeNode } from '../../api/types';

/** Keys of every recipe node in the tree (recursive). */
export function collectRecipeKeys(node: TreeNode, maxDepth = Infinity): string[] {
  if (node.type !== 'recipe' || node.depth >= maxDepth) return [];
  return [node.key, ...node.children.flatMap((child) => collectRecipeKeys(child, maxDepth))];
}

/** Counts recipe nodes, ingredient lines and the deepest recipe level (recursive). */
export function treeStats(root: RecipeTreeNode): {
  recipes: number;
  ingredients: number;
  depth: number;
} {
  const stats = { recipes: 0, ingredients: 0, depth: 0 };
  const visit = (node: TreeNode) => {
    if (node.type === 'ingredient') {
      stats.ingredients += 1;
      return;
    }
    stats.recipes += 1;
    stats.depth = Math.max(stats.depth, node.depth);
    node.children.forEach(visit);
  };
  visit(root);
  return stats;
}
