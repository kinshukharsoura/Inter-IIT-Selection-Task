import { Db, prisma, Tx } from '../lib/prisma';
import { ComponentData, DependencyGraph, RecipeData, RecipeGraph } from '../domain/types';

/**
 * Loads every recipe reachable from `rootIds` (the roots plus all nested
 * sub-recipes, at any depth) in TWO queries, regardless of nesting depth:
 *
 *   1. a recursive CTE walks recipe_components to collect the reachable ids
 *      (UNION — not UNION ALL — de-duplicates, so it terminates even if the
 *      data were ever cyclic);
 *   2. one findMany loads those recipes with their components and ingredient names.
 *
 * This avoids the N+1 pattern of fetching each nested recipe separately, and
 * each recipe is loaded once even if it is reused in many places.
 */
export async function loadRecipeGraph(db: Db, rootIds: readonly string[]): Promise<RecipeGraph> {
  if (rootIds.length === 0) return new Map();

  const rows = await db.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE reachable(id) AS (
      SELECT unnest(${[...rootIds]}::uuid[])
      UNION
      SELECT rc.child_recipe_id
      FROM recipe_components rc
      JOIN reachable r ON rc.recipe_id = r.id
      WHERE rc.child_recipe_id IS NOT NULL
    )
    SELECT id::text AS id FROM reachable`;

  const recipes = await db.recipe.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      servings: true,
      components: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          quantity: true,
          unit: true,
          ingredientId: true,
          childRecipeId: true,
          ingredient: { select: { name: true } },
        },
      },
    },
  });

  const graph = new Map<string, RecipeData>();
  for (const recipe of recipes) {
    graph.set(recipe.id, {
      id: recipe.id,
      name: recipe.name,
      description: recipe.description,
      category: recipe.category,
      servings: recipe.servings,
      components: recipe.components.map(toComponentData),
    });
  }
  return graph;
}

function toComponentData(c: {
  id: string;
  position: number;
  quantity: number;
  unit: string;
  ingredientId: string | null;
  childRecipeId: string | null;
  ingredient: { name: string } | null;
}): ComponentData {
  if (c.childRecipeId) {
    return {
      id: c.id,
      type: 'recipe',
      position: c.position,
      quantity: c.quantity,
      unit: c.unit,
      childRecipeId: c.childRecipeId,
    };
  }
  return {
    id: c.id,
    type: 'ingredient',
    position: c.position,
    quantity: c.quantity,
    unit: c.unit,
    ingredientId: c.ingredientId as string,
    ingredientName: c.ingredient?.name ?? 'Unknown ingredient',
  };
}

/** Loads the user's recipe → sub-recipe edges (one query) for cycle detection. */
export async function loadDependencyGraph(db: Db, userId: string): Promise<DependencyGraph> {
  const edges = await db.recipeComponent.findMany({
    where: { childRecipeId: { not: null }, recipe: { userId } },
    select: { recipeId: true, childRecipeId: true },
  });
  const graph = new Map<string, string[]>();
  for (const edge of edges) {
    const list = graph.get(edge.recipeId) ?? [];
    list.push(edge.childRecipeId as string);
    graph.set(edge.recipeId, list);
  }
  return graph;
}

/** Reverses a dependency graph: child id -> ids of recipes that use it. */
export function reverseGraph(graph: DependencyGraph): Map<string, string[]> {
  const reversed = new Map<string, string[]>();
  for (const [parent, children] of graph) {
    for (const child of children) {
      const list = reversed.get(child) ?? [];
      list.push(parent);
      reversed.set(child, list);
    }
  }
  return reversed;
}

/** Generous limits: waiting for the per-user lock counts against `maxWait`. */
const GRAPH_TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

/**
 * Runs `fn` in a transaction that first takes a per-user advisory lock, so all
 * recipe-graph mutations of one user are serialised: two concurrent requests
 * cannot each pass the cycle check and together create a cycle (A→B and B→A
 * at the same time). The lock is released automatically at commit/rollback.
 */
export function withUserGraphLock<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${userId}))) AS l`;
    return fn(tx);
  }, GRAPH_TX_OPTIONS);
}
