import { ChefHat, Leaf } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { errorMessage } from '../../api/client';
import type { RecipeInput } from '../../api/types';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Field, Input, Textarea } from '../../components/ui/FormControls';
import { LoadingState } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/States';
import { ComponentRow } from './ComponentRow';
import { useCategories, useIngredients, useRecipes, useRecipeUsages, useUnits } from './queries';
import {
  ComponentDraft,
  draftToInput,
  DraftErrors,
  hasErrors,
  MAX_SERVINGS,
  moveItem,
  newComponentDraft,
  RecipeDraft,
  validateDraft,
} from './recipeDraft';

interface RecipeFormProps {
  initialDraft: RecipeDraft;
  /** Set when editing: the recipe itself and its users can't become its components. */
  recipeId?: string;
  submitLabel: string;
  cancelTo: string;
  onSubmit: (input: RecipeInput) => Promise<void>;
}

export function RecipeForm({
  initialDraft,
  recipeId,
  submitLabel,
  cancelTo,
  onSubmit,
}: RecipeFormProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [errors, setErrors] = useState<DraftErrors | null>(null);
  const [submitError, setSubmitError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const ingredients = useIngredients();
  const recipes = useRecipes({ sort: 'name' });
  const units = useUnits();
  const categories = useCategories();
  const usages = useRecipeUsages(recipeId);

  // Self + every recipe that (transitively) uses this one: choosing any of them would create a cycle.
  const blockedRecipeIds = useMemo(() => {
    const ids = new Set<string>(usages.data?.transitive.map((r) => r.id) ?? []);
    if (recipeId) ids.add(recipeId);
    return ids;
  }, [usages.data, recipeId]);

  const update = (patch: Partial<RecipeDraft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    // After a first submit attempt, keep the inline errors live while the user fixes them.
    if (errors) setErrors(validateDraft(next));
  };

  const updateComponent = (key: string, patch: Partial<ComponentDraft>) =>
    update({ components: draft.components.map((c) => (c.key === key ? { ...c, ...patch } : c)) });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors = validateDraft(draft);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      setSubmitError('Please fix the highlighted fields.');
      return;
    }
    setSubmitError(undefined);
    setSubmitting(true);
    try {
      await onSubmit(draftToInput(draft));
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (ingredients.isPending || recipes.isPending || units.isPending) {
    return <LoadingState label="Loading ingredients and recipes…" />;
  }
  if (ingredients.isError || recipes.isError || units.isError) {
    return (
      <ErrorState
        message={errorMessage(ingredients.error ?? recipes.error ?? units.error)}
        onRetry={() => {
          void ingredients.refetch();
          void recipes.refetch();
          void units.refetch();
        }}
      />
    );
  }

  const selectableRecipes = recipes.data.filter((r) => r.id !== recipeId);

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-6">
      <Card>
        <CardHeader title="Details" description="Basic information about the recipe." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={errors?.name} className="sm:col-span-2">
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                value={draft.name}
                maxLength={120}
                required
                placeholder="e.g. Tomato Sauce"
                onChange={(e) => update({ name: e.target.value })}
              />
            )}
          </Field>
          <Field label="Description" className="sm:col-span-2" hint="Optional">
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                rows={3}
                value={draft.description}
                onChange={(e) => update({ description: e.target.value })}
              />
            )}
          </Field>
          <Field label="Servings" error={errors?.servings} hint="How many servings one batch makes">
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_SERVINGS}
                step={1}
                required
                value={draft.servings}
                onChange={(e) => update({ servings: e.target.value })}
              />
            )}
          </Field>
          <Field label="Category" hint="Optional, e.g. Sauces">
            {({ id, describedBy }) => (
              <>
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  list={`${id}-options`}
                  value={draft.category}
                  maxLength={60}
                  onChange={(e) => update({ category: e.target.value })}
                />
                <datalist id={`${id}-options`}>
                  {categories.data?.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Components"
          description="Combine raw ingredients with recipes you have already created."
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={<Leaf aria-hidden="true" className="size-4 text-emerald-600" />}
                onClick={() =>
                  update({ components: [...draft.components, newComponentDraft('ingredient')] })
                }
              >
                Add ingredient
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<ChefHat aria-hidden="true" className="size-4 text-brand-600" />}
                onClick={() =>
                  update({ components: [...draft.components, newComponentDraft('recipe')] })
                }
                disabled={selectableRecipes.length === 0}
                title={selectableRecipes.length === 0 ? 'Create another recipe first' : undefined}
              >
                Add existing recipe
              </Button>
            </>
          }
        />
        <CardBody>
          {draft.components.length === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
              No components yet. Add ingredients, or reuse an existing recipe such as a sauce or
              dough.
            </p>
          ) : (
            <ol className="space-y-3" aria-label="Recipe components">
              {draft.components.map((component, index) => (
                <ComponentRow
                  key={component.key}
                  draft={component}
                  index={index}
                  count={draft.components.length}
                  errors={errors?.components[component.key]}
                  ingredients={ingredients.data}
                  recipes={selectableRecipes}
                  blockedRecipeIds={blockedRecipeIds}
                  units={units.data}
                  onChange={(patch) => updateComponent(component.key, patch)}
                  onMove={(direction) =>
                    update({ components: moveItem(draft.components, index, index + direction) })
                  }
                  onRemove={() =>
                    update({ components: draft.components.filter((c) => c.key !== component.key) })
                  }
                />
              ))}
            </ol>
          )}
        </CardBody>
      </Card>

      {submitError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          {submitError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <ButtonLink to={cancelTo} variant="secondary">
          Cancel
        </ButtonLink>
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
