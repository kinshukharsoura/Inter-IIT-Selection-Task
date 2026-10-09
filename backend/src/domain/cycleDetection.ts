import { DependencyGraph } from './types';

/**
 * Returns the dependency path from `fromId` to `targetId` (inclusive), or null if
 * `targetId` is not reachable. Iterative DFS with a global visited set, so it is
 * O(V + E), works for any depth and never loops forever even on a corrupted
 * (already cyclic) graph.
 */
export function findPath(
  graph: DependencyGraph,
  fromId: string,
  targetId: string,
): string[] | null {
  const visited = new Set<string>();
  const parent = new Map<string, string>();
  const stack = [fromId];

  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === targetId) return buildPath(parent, fromId, targetId);
    if (visited.has(current)) continue;
    visited.add(current);

    for (const next of graph.get(current) ?? []) {
      if (!visited.has(next)) {
        if (!parent.has(next)) parent.set(next, current);
        stack.push(next);
      }
    }
  }
  return null;
}

/**
 * Would adding the edge parent → child create a circular dependency?
 * That is the case when the child is the parent itself, or the parent is
 * already reachable from the child (child → … → parent).
 *
 * Returns the offending cycle (e.g. ["A", "B", "C", "A"]) or null.
 */
export function detectCycleOnAdd(
  graph: DependencyGraph,
  parentId: string,
  childId: string,
): string[] | null {
  if (parentId === childId) return [parentId, childId];
  const path = findPath(graph, childId, parentId);
  return path ? [parentId, ...path] : null;
}

/**
 * Finds any cycle in the whole graph (used to validate imported datasets).
 * Uses the classic three-colour DFS: the *current recursion path* (grey) is
 * tracked separately from the *globally finished* set (black). Implemented
 * iteratively so that very deep graphs cannot overflow the call stack.
 */
export function findAnyCycle(graph: DependencyGraph): string[] | null {
  const finished = new Set<string>();
  const onPath = new Set<string>();

  for (const start of graph.keys()) {
    if (finished.has(start)) continue;
    const path: string[] = [];
    const iterators: Iterator<string>[] = [];

    const enter = (id: string) => {
      path.push(id);
      onPath.add(id);
      iterators.push((graph.get(id) ?? [])[Symbol.iterator]());
    };
    enter(start);

    while (iterators.length > 0) {
      const step = (iterators[iterators.length - 1] as Iterator<string>).next();
      if (step.done) {
        const id = path.pop() as string;
        iterators.pop();
        onPath.delete(id);
        finished.add(id);
        continue;
      }
      const next = step.value;
      if (onPath.has(next)) return [...path.slice(path.indexOf(next)), next];
      if (!finished.has(next)) enter(next);
    }
  }
  return null;
}

function buildPath(parent: Map<string, string>, fromId: string, targetId: string): string[] {
  const path = [targetId];
  let current = targetId;
  while (current !== fromId) {
    current = parent.get(current) as string;
    path.push(current);
  }
  return path.reverse();
}

/** All ids reachable from `startId` (excluding it), via iterative BFS with a visited set. */
export function collectReachable(graph: DependencyGraph, startId: string): Set<string> {
  const visited = new Set<string>();
  const queue = [...(graph.get(startId) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (visited.has(current) || current === startId) continue;
    visited.add(current);
    queue.push(...(graph.get(current) ?? []));
  }
  return visited;
}
