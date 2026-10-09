import { DependencyGraph } from './types';

/**
 * Number of edges on the longest path starting at `startId` (0 for a leaf).
 * Memoised DFS over a DAG: O(V + E). Assumes the graph is acyclic, which the
 * write path guarantees; a path guard still stops it from looping on bad data.
 */
export function longestPathFrom(
  graph: DependencyGraph,
  startId: string,
  memo = new Map<string, number>(),
  onPath = new Set<string>(),
): number {
  const cached = memo.get(startId);
  if (cached !== undefined) return cached;
  if (onPath.has(startId)) return 0;

  onPath.add(startId);
  let longest = 0;
  for (const next of graph.get(startId) ?? []) {
    longest = Math.max(longest, 1 + longestPathFrom(graph, next, memo, onPath));
  }
  onPath.delete(startId);
  memo.set(startId, longest);
  return longest;
}

/**
 * Deepest nesting level that adding parent → child would create: the longest
 * chain of recipes above the parent + 1 + the longest chain below the child.
 */
export function nestingDepthWithEdge(
  graph: DependencyGraph,
  reversed: DependencyGraph,
  parentId: string,
  childId: string,
): number {
  return longestPathFrom(reversed, parentId) + 1 + longestPathFrom(graph, childId);
}
