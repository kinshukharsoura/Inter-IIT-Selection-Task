import {
  AlertTriangle,
  ChefHat,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ExternalLink,
  Leaf,
} from 'lucide-react';
import { KeyboardEvent, useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { RecipeTreeNode, TreeNode } from '../../api/types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
import { formatAmount, formatQuantity, formatRecipeUsage, pluralize } from '../../lib/format';
import { collectRecipeKeys, treeStats } from './treeUtils';

/** Recipe levels expanded when the tree first renders (root + its direct sub-recipes). */
const DEFAULT_EXPANDED_DEPTH = 2;

interface RecipeTreeProps {
  root: RecipeTreeNode;
}

/**
 * Recursive recipe explorer. `TreeBranch` renders a recipe node and, when
 * expanded, renders itself again for each nested recipe — there is no fixed
 * number of levels. Expansion state lives here, keyed by each node's unique
 * path key, so "Expand all"/"Collapse all" work across the whole tree.
 */
export function RecipeTree({ root }: RecipeTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(collectRecipeKeys(root, DEFAULT_EXPANDED_DEPTH)),
  );
  const stats = useMemo(() => treeStats(root), [root]);

  const toggle = useCallback((key: string, open?: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      const shouldOpen = open ?? !next.has(key);
      if (shouldOpen) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-5 py-3">
        <p className="text-xs text-stone-500">
          {pluralize(stats.recipes - 1, 'nested recipe')} ·{' '}
          {pluralize(stats.ingredients, 'ingredient line')} · {pluralize(stats.depth + 1, 'level')}{' '}
          deep
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<ChevronsUpDown aria-hidden="true" className="size-4" />}
            onClick={() => setExpanded(new Set(collectRecipeKeys(root)))}
          >
            Expand all
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<ChevronsDownUp aria-hidden="true" className="size-4" />}
            onClick={() => setExpanded(new Set([root.key]))}
          >
            Collapse all
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto px-3 py-3 sm:px-5">
        <ul aria-label={`Composition of ${root.name}`} className="min-w-fit">
          <TreeBranch node={root} expanded={expanded} onToggle={toggle} />
        </ul>
      </div>
    </div>
  );
}

interface BranchProps {
  node: TreeNode;
  expanded: ReadonlySet<string>;
  onToggle: (key: string, open?: boolean) => void;
}

function TreeBranch({ node, expanded, onToggle }: BranchProps) {
  if (node.type === 'ingredient') return <IngredientRow node={node} />;

  const hasChildren = node.children.length > 0;
  const isOpen = hasChildren && expanded.has(node.key);
  const groupId = `tree-group-${node.key.replace(/[^a-zA-Z0-9-]/g, '-')}`;

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowRight' && !isOpen) {
      e.preventDefault();
      onToggle(node.key, true);
    } else if (e.key === 'ArrowLeft' && isOpen) {
      e.preventDefault();
      onToggle(node.key, false);
    }
  };

  return (
    <li>
      <div
        className={cn(
          'group flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-stone-50',
          node.depth === 0 && 'bg-brand-50/60 hover:bg-brand-50',
        )}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.key)}
            onKeyDown={onKeyDown}
            aria-expanded={isOpen}
            aria-controls={groupId}
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${node.name}`}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-800"
          >
            <ChevronRight
              aria-hidden="true"
              className={cn('size-4 transition-transform', isOpen && 'rotate-90')}
            />
          </button>
        ) : (
          <span className="size-7 shrink-0" aria-hidden="true" />
        )}

        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <ChefHat aria-hidden="true" className="size-4" />
        </span>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn('font-semibold text-stone-900', node.depth === 0 && 'text-base')}>
            {node.name}
          </span>
          <Badge tone="recipe">Recipe</Badge>
          {node.quantity !== null && node.unit !== null && (
            <span className="text-sm text-stone-600">
              {formatRecipeUsage(node.quantity, node.unit)}
            </span>
          )}
          <span className="text-xs text-stone-500">
            {node.scaleFactor !== 1 && <>×{formatQuantity(node.scaleFactor)} batch · </>}
            makes {pluralize(node.yieldServings, 'serving')}
          </span>
          {node.circular && (
            <Badge tone="warning">
              <AlertTriangle aria-hidden="true" className="size-3" /> Circular reference — not
              expanded
            </Badge>
          )}
          {!hasChildren && !node.circular && (
            <span className="text-xs italic text-stone-400">No components yet</span>
          )}
        </div>

        {node.depth > 0 && (
          <Link
            to={`/recipes/${node.recipeId}`}
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
            aria-label={`Open recipe ${node.name}`}
          >
            <ExternalLink aria-hidden="true" className="size-3.5" />
            <span className="hidden sm:inline">Open</span>
          </Link>
        )}
      </div>

      {isOpen && (
        <ul
          id={groupId}
          aria-label={`Components of ${node.name}`}
          className="ml-[1.375rem] border-l border-stone-200 pl-3"
        >
          {node.children.map((child) => (
            <TreeBranch key={child.key} node={child} expanded={expanded} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </li>
  );
}

function IngredientRow({ node }: { node: Extract<TreeNode, { type: 'ingredient' }> }) {
  const scaled = node.quantity !== node.baseQuantity;
  return (
    <li className="flex min-h-10 items-center gap-2 rounded-lg px-2 py-1 hover:bg-stone-50">
      <span className="size-7 shrink-0" aria-hidden="true" />
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <Leaf aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0 text-stone-800">{node.name}</span>
      <Badge tone="ingredient">Ingredient</Badge>
      <span className="ml-auto whitespace-nowrap pl-4 text-right font-mono text-sm tabular-nums text-stone-900">
        {formatAmount(node.quantity, node.unit)}
        {scaled && (
          <span className="block text-xs text-stone-400">
            recipe: {formatAmount(node.baseQuantity, node.unit)}
          </span>
        )}
      </span>
    </li>
  );
}
