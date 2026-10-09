import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Leaf, Lock, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '../api/client';
import { ingredientsApi } from '../api/endpoints';
import type { Ingredient } from '../api/types';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Field, Input, Select } from '../components/ui/FormControls';
import { LoadingState } from '../components/ui/Spinner';
import { EmptyState, ErrorState } from '../components/ui/States';
import { ingredientKeys, recipeKeys, useIngredients, useUnits } from '../features/recipes/queries';
import { pluralize } from '../lib/format';

interface IngredientFormValue {
  name: string;
  defaultUnit: string;
}

export function IngredientsPage() {
  const ingredients = useIngredients();
  const units = useUnits();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [toDelete, setToDelete] = useState<Ingredient | null>(null);

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ingredientKeys.all }),
      queryClient.invalidateQueries({ queryKey: recipeKeys.all }),
    ]);

  const save = useMutation({
    mutationFn: (value: IngredientFormValue & { id?: string }) =>
      value.id
        ? ingredientsApi.update(value.id, {
            name: value.name,
            defaultUnit: value.defaultUnit || null,
          })
        : ingredientsApi.create({ name: value.name, defaultUnit: value.defaultUnit || null }),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: ingredientsApi.remove, onSuccess: invalidate });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (ingredients.data ?? []).filter((i) => i.name.toLowerCase().includes(term));
  }, [ingredients.data, search]);

  const submit = async (value: IngredientFormValue & { id?: string }) => {
    const saved = await save.mutateAsync(value);
    toast.success(value.id ? `"${saved.name}" updated` : `"${saved.name}" added`);
    setEditing(null);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await remove.mutateAsync(toDelete.id);
      toast.success(`"${toDelete.name}" deleted`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setToDelete(null);
  };

  return (
    <>
      <PageHeader
        title="Ingredients"
        description="The shared ingredient catalogue used by all recipes. You can edit or delete ingredients you created, as long as no recipe uses them."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="h-fit lg:order-2">
          <CardHeader title={editing ? `Edit ${editing.name}` : 'Add ingredient'} />
          <CardBody>
            <IngredientForm
              key={editing?.id ?? 'new'}
              initial={
                editing
                  ? { name: editing.name, defaultUnit: editing.defaultUnit ?? '' }
                  : { name: '', defaultUnit: 'g' }
              }
              unitCodes={units.data?.ingredientUnits.map((u) => u.code) ?? []}
              submitLabel={editing ? 'Save' : 'Add ingredient'}
              loading={save.isPending}
              onSubmit={(value) => submit({ ...value, id: editing?.id })}
              onCancel={editing ? () => setEditing(null) : undefined}
            />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2 lg:order-1">
          <CardHeader
            title="Catalogue"
            description={
              ingredients.data ? pluralize(ingredients.data.length, 'ingredient') : undefined
            }
            actions={
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-2.5 size-4 text-stone-400"
                />
                <label htmlFor="ingredient-search" className="sr-only">
                  Search ingredients
                </label>
                <Input
                  id="ingredient-search"
                  type="search"
                  className="h-9 w-56 pl-9"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            }
          />
          {ingredients.isPending ? (
            <LoadingState label="Loading ingredients…" />
          ) : ingredients.isError ? (
            <CardBody>
              <ErrorState
                message={errorMessage(ingredients.error)}
                onRetry={() => void ingredients.refetch()}
              />
            </CardBody>
          ) : filtered.length === 0 ? (
            <CardBody>
              <EmptyState
                icon={<Leaf className="size-10" />}
                title={search ? 'No matching ingredients' : 'No ingredients yet'}
                description={search ? undefined : 'Add your first ingredient using the form.'}
              />
            </CardBody>
          ) : (
            <ul className="divide-y divide-stone-100">
              {filtered.map((ingredient) => (
                <li key={ingredient.id} className="flex items-center gap-3 px-5 py-2.5">
                  <Leaf aria-hidden="true" className="size-4 shrink-0 text-emerald-600" />
                  <span className="font-medium text-stone-800">{ingredient.name}</span>
                  {ingredient.defaultUnit && <Badge>{ingredient.defaultUnit}</Badge>}
                  <span className="text-xs text-stone-500">
                    {ingredient.usageCount > 0
                      ? `used ${pluralize(ingredient.usageCount, 'time')}`
                      : 'unused'}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    {ingredient.editable ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(ingredient)}
                          aria-label={`Edit ${ingredient.name}`}
                          icon={<Pencil aria-hidden="true" className="size-4" />}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => setToDelete(ingredient)}
                          disabled={ingredient.usageCount > 0}
                          title={
                            ingredient.usageCount > 0
                              ? 'Used in recipes — remove it from them first'
                              : undefined
                          }
                          aria-label={`Delete ${ingredient.name}`}
                          icon={<Trash2 aria-hidden="true" className="size-4" />}
                        />
                      </>
                    ) : (
                      <span
                        className="flex items-center gap-1 text-xs text-stone-400"
                        title="Created by another user or the dataset"
                      >
                        <Lock aria-hidden="true" className="size-3.5" /> shared
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete "${toDelete?.name ?? ''}"?`}
        description="The ingredient will be removed from the catalogue."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

function IngredientForm({
  initial,
  unitCodes,
  submitLabel,
  loading,
  onSubmit,
  onCancel,
}: {
  initial: IngredientFormValue;
  unitCodes: string[];
  submitLabel: string;
  loading: boolean;
  onSubmit: (value: IngredientFormValue) => Promise<void>;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string>();

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      await onSubmit({ ...value, name: value.name.trim() });
      setValue(initial);
      setError(undefined);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <form onSubmit={(e) => void handle(e)} noValidate className="space-y-4">
      <Field label="Name" error={error}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            value={value.name}
            maxLength={120}
            onChange={(e) => setValue((v) => ({ ...v, name: e.target.value }))}
          />
        )}
      </Field>
      <Field label="Default unit" hint="Pre-selected when the ingredient is added to a recipe">
        {({ id, describedBy }) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            value={value.defaultUnit}
            onChange={(e) => setValue((v) => ({ ...v, defaultUnit: e.target.value }))}
          >
            <option value="">None</option>
            {unitCodes.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          loading={loading}
          icon={<Plus aria-hidden="true" className="size-4" />}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
