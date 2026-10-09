import { describe, expect, it } from 'vitest';
import { longestPathFrom, nestingDepthWithEdge } from '../../src/domain/dependencyDepth';
import { reverseGraph } from '../../src/services/recipeGraph.service';

const g = (edges: Record<string, string[]>) => new Map(Object.entries(edges));

describe('dependency depth', () => {
  it('measures the longest chain below a recipe', () => {
    const graph = g({ A: ['B', 'C'], B: ['D'], D: ['E'] });
    expect(longestPathFrom(graph, 'A')).toBe(3);
    expect(longestPathFrom(graph, 'C')).toBe(0);
  });

  it('computes the nesting depth an extra edge would create', () => {
    // X → P (1 above P) ; C → D → E (2 below C) ⇒ X → P → C → D → E = 4 edges
    const graph = g({ X: ['P'], C: ['D'], D: ['E'] });
    expect(nestingDepthWithEdge(graph, reverseGraph(graph), 'P', 'C')).toBe(4);
  });

  it('handles long chains', () => {
    const edges: Record<string, string[]> = {};
    for (let i = 0; i < 150; i += 1) edges[`R${i}`] = [`R${i + 1}`];
    expect(longestPathFrom(g(edges), 'R0')).toBe(150);
  });
});
