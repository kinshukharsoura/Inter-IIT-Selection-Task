import { useMutation } from '@tanstack/react-query';
import { ClipboardCopy, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '../api/client';
import { shoppingListApi } from '../api/endpoints';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Field, Input, Select } from '../components/ui/FormControls';
import { LoadingState } from '../components/ui/Spinner';
import { EmptyState, ErrorState } from '../components/ui/States';
import { useRecipes } from '../features/recipes/queries';
import { formatAmount, pluralize, totalsAsText } from '../lib/format';

interface PlanItem {
  key: number;
  recipeId: string;
  servings: string;
}

let nextKey = 1;

/** Bonus feature: one consolidated shopping list for several recipes, each scaled independently. */
export function ShoppingListPage() {
  const recipes = useRecipes({ sort: 'name' });
  const [items, setItems] = useState<PlanItem[]>([{ key: nextKey++, recipeId: '', servings: '' }]);
  const build = useMutation({ mutationFn: shoppingListApi.build });

  const update = (key: number, patch: Partial<PlanItem>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const valid = items.filter((i) => i.recipeId);
  const generate = () => {
    if (valid.length === 0) {
      toast.error('Choose at least one recipe');
      return;
    }
    build.mutate(
      valid.map((i) => ({
        recipeId: i.recipeId,
        servings: Number(i.servings) > 0 ? Number(i.servings) : undefined,
      })),
    );
  };

  const copy = async () => {
    if (!build.data) return;
    try {
      await navigator.clipboard.writeText(totalsAsText('Shopping list', build.data.ingredients));
      toast.success('Shopping list copied');
    } catch {
      toast.error('Could not access the clipboard');
    }
  };

  if (recipes.isPending) return <LoadingState label="Loading recipes…" />;
  if (recipes.isError)
    return (
      <ErrorState message={errorMessage(recipes.error)} onRetry={() => void recipes.refetch()} />
    );

  return (
    <>
      <PageHeader
        title="Shopping list"
        description="Plan several dishes at once. Every nested recipe is expanded and identical ingredients are combined."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-fit">
          <CardHeader
            title="Plan"
            description="Pick recipes and how many servings of each you need."
          />
          <CardBody className="space-y-3">
            {recipes.data.length === 0 ? (
              <EmptyState title="No recipes yet" description="Create a recipe first." />
            ) : (
              items.map((item, index) => {
                const recipe = recipes.data.find((r) => r.id === item.recipeId);
                return (
                  <div key={item.key} className="flex flex-wrap items-end gap-2">
                    <Field label={`Recipe ${index + 1}`} hideLabel className="min-w-48 flex-1">
                      {({ id }) => (
                        <Select
                          id={id}
                          value={item.recipeId}
                          onChange={(e) => update(item.key, { recipeId: e.target.value })}
                        >
                          <option value="">Choose a recipe…</option>
                          {recipes.data.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                    <Field label={`Servings for recipe ${index + 1}`} hideLabel className="w-28">
                      {({ id }) => (
                        <Input
                          id={id}
                          type="number"
                          min={1}
                          placeholder={recipe ? String(recipe.servings) : 'Servings'}
                          value={item.servings}
                          onChange={(e) => update(item.key, { servings: e.target.value })}
                        />
                      )}
                    </Field>
                    <Button
                      variant="ghost"
                      onClick={() => setItems((list) => list.filter((i) => i.key !== item.key))}
                      disabled={items.length === 1}
                      aria-label={`Remove recipe ${index + 1}`}
                      icon={<Trash2 aria-hidden="true" className="size-4" />}
                    />
                  </div>
                );
              })
            )}
            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setItems((list) => [...list, { key: nextKey++, recipeId: '', servings: '' }])
                }
                icon={<Plus aria-hidden="true" className="size-4" />}
              >
                Add recipe
              </Button>
              <Button
                onClick={generate}
                loading={build.isPending}
                icon={<ShoppingCart aria-hidden="true" className="size-4" />}
              >
                Generate list
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card className="h-fit">
          <CardHeader
            title="Ingredients to buy"
            description={
              build.data
                ? `For ${build.data.recipes.map((r) => `${r.name} (${pluralize(r.servings, 'serving')})`).join(', ')}`
                : undefined
            }
            actions={
              build.data && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void copy()}
                  icon={<ClipboardCopy aria-hidden="true" className="size-4" />}
                >
                  Copy
                </Button>
              )
            }
          />
          <CardBody>
            {build.isError ? (
              <ErrorState message={errorMessage(build.error)} />
            ) : !build.data ? (
              <p className="py-8 text-center text-sm text-stone-500">Your list will appear here.</p>
            ) : (
              <ul className="divide-y divide-stone-100" aria-live="polite">
                {build.data.ingredients.map((i) => (
                  <li
                    key={`${i.ingredientId}-${i.unit}`}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="size-4 accent-brand-600" />
                      {i.name}
                    </label>
                    <span className="font-mono tabular-nums">
                      {formatAmount(i.quantity, i.unit)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
