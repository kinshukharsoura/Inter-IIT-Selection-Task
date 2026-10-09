import { describe, expect, it } from 'vitest';
import {
  collectReachable,
  detectCycleOnAdd,
  findAnyCycle,
  findPath,
} from '../../src/domain/cycleDetection';

const g = (edges: Record<string, string[]>) => new Map(Object.entries(edges));

describe('detectCycleOnAdd', () => {
  it('rejects self-reference A → A', () => {
    expect(detectCycleOnAdd(g({}), 'A', 'A')).toEqual(['A', 'A']);
  });

  it('rejects A → B → A (adding B → A when A → B exists)', () => {
    expect(detectCycleOnAdd(g({ A: ['B'] }), 'B', 'A')).toEqual(['B', 'A', 'B']);
  });

  it('rejects A → B → C → A', () => {
    expect(detectCycleOnAdd(g({ A: ['B'], B: ['C'] }), 'C', 'A')).toEqual(['C', 'A', 'B', 'C']);
  });

  it('rejects a cycle closing a long chain of arbitrary depth', () => {
    const depth = 500;
    const edges: Record<string, string[]> = {};
    for (let i = 0; i < depth; i += 1) edges[`R${i}`] = [`R${i + 1}`];
    const cycle = detectCycleOnAdd(g(edges), `R${depth}`, 'R0');
    expect(cycle).not.toBeNull();
    expect(cycle).toHaveLength(depth + 2);
    expect(cycle?.[0]).toBe(`R${depth}`);
    expect(cycle?.at(-1)).toBe(`R${depth}`);
  });

  it('allows edges that do not close a cycle', () => {
    const graph = g({ A: ['B'], B: ['C'] });
    expect(detectCycleOnAdd(graph, 'A', 'C')).toBeNull(); // shortcut A → C
    expect(detectCycleOnAdd(graph, 'D', 'A')).toBeNull(); // new parent on top
  });

  it('allows diamonds (shared sub-recipes are not cycles)', () => {
    // Pizza → Sauce, Pizza → Dough, Sauce → Tomato Base, Dough is unrelated
    const graph = g({ Pizza: ['Sauce', 'Dough'], Sauce: ['TomatoBase'] });
    expect(detectCycleOnAdd(graph, 'Dough', 'TomatoBase')).toBeNull();
  });

  it('terminates on an already-corrupted cyclic graph', () => {
    const graph = g({ A: ['B'], B: ['A'] });
    expect(detectCycleOnAdd(graph, 'C', 'A')).toBeNull();
    expect(detectCycleOnAdd(graph, 'B', 'A')).not.toBeNull();
  });
});

describe('findPath', () => {
  it('returns the path between two nodes', () => {
    expect(findPath(g({ A: ['B', 'X'], B: ['C'] }), 'A', 'C')).toEqual(['A', 'B', 'C']);
  });

  it('returns null when unreachable', () => {
    expect(findPath(g({ A: ['B'] }), 'B', 'A')).toBeNull();
  });
});

describe('findAnyCycle', () => {
  it('returns null for a DAG with shared nodes', () => {
    expect(findAnyCycle(g({ A: ['B', 'C'], B: ['D'], C: ['D'], D: [] }))).toBeNull();
  });

  it('finds self loops and longer cycles', () => {
    expect(findAnyCycle(g({ A: ['A'] }))).toEqual(['A', 'A']);
    expect(findAnyCycle(g({ A: ['B'], B: ['C'], C: ['A'] }))).toEqual(['A', 'B', 'C', 'A']);
  });

  it('handles very deep graphs without stack overflow', () => {
    const edges: Record<string, string[]> = {};
    for (let i = 0; i < 20_000; i += 1) edges[`R${i}`] = [`R${i + 1}`];
    expect(findAnyCycle(g(edges))).toBeNull();
  });
});

describe('collectReachable', () => {
  it('collects all transitive dependencies once', () => {
    const reachable = collectReachable(g({ A: ['B', 'C'], B: ['D'], C: ['D'] }), 'A');
    expect([...reachable].sort()).toEqual(['B', 'C', 'D']);
  });
});
