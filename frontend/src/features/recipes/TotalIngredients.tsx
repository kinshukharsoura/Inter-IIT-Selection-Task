import { ClipboardCopy } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/Spinner';
import { EmptyState, ErrorState } from '../../components/ui/States';
import { formatAmount, formatQuantity, totalsAsText } from '../../lib/format';
import { useIngredientTotals } from './queries';

/** Consolidated raw-ingredient list of a recipe, computed recursively by the API. */
export function TotalIngredients({ recipeId, servings }: { recipeId: string; servings?: number }) {
  const query = useIngredientTotals(recipeId, servings);

  if (query.isPending) return <LoadingState label="Expanding all nested recipes…" />;
  if (query.isError)
    return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;

  const { ingredients, name } = query.data;
  if (ingredients.length === 0) {
    return (
      <EmptyState
        title="No ingredients yet"
        description="Add ingredients or sub-recipes to see the totals."
      />
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        totalsAsText(`${name} — ${formatQuantity(query.data.servings)} servings`, ingredients),
      );
      toast.success('Ingredient list copied to clipboard');
    } catch {
      toast.error('Could not access the clipboard');
    }
  };

  return (
    <div>
      <table className="w-full text-sm">
        <caption className="sr-only">
          Total ingredients for {formatQuantity(query.data.servings)} servings of {name}
        </caption>
        <thead>
          <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
            <th scope="col" className="py-2 font-medium">
              Ingredient
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Quantity
            </th>
          </tr>
        </thead>
        <tbody className={query.isPlaceholderData ? 'opacity-60' : undefined}>
          {ingredients.map((item) => (
            <tr
              key={`${item.ingredientId}-${item.unit}`}
              className="border-b border-stone-100 last:border-0"
            >
              <td className="py-2 text-stone-800">{item.name}</td>
              <td className="py-2 text-right font-mono tabular-nums text-stone-900">
                {formatAmount(item.quantity, item.unit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void copy()}
          icon={<ClipboardCopy aria-hidden="true" className="size-4" />}
        >
          Copy list
        </Button>
      </div>
    </div>
  );
}
