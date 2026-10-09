import { ArrowDown, ArrowUp, ChefHat, Leaf, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Ingredient, RecipeSummary, UnitsResponse } from '../../api/types';
import { Badge } from '../../components/ui/Badge';
import { Field, Input, Select } from '../../components/ui/FormControls';
import { cn } from '../../lib/cn';
import { NewIngredientInline } from './NewIngredientInline';
import { ComponentDraft, DraftErrors } from './recipeDraft';

interface ComponentRowProps {
  draft: ComponentDraft;
  index: number;
  count: number;
  errors?: DraftErrors['components'][string];
  ingredients: Ingredient[];
  recipes: RecipeSummary[];
  /** Recipes that cannot be chosen because they would create a cycle. */
  blockedRecipeIds: ReadonlySet<string>;
  units: UnitsResponse;
  onChange: (patch: Partial<ComponentDraft>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

const iconButton =
  'flex size-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-30 disabled:hover:bg-transparent';

export function ComponentRow({
  draft,
  index,
  count,
  errors,
  ingredients,
  recipes,
  blockedRecipeIds,
  units,
  onChange,
  onMove,
  onRemove,
}: ComponentRowProps) {
  const [creatingIngredient, setCreatingIngredient] = useState(false);
  const isRecipe = draft.type === 'recipe';
  const position = `component ${index + 1}`;

  return (
    <li
      className={cn(
        'rounded-xl border bg-white p-3 shadow-sm',
        isRecipe ? 'border-brand-200' : 'border-emerald-200',
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 items-center">
          <Badge tone={isRecipe ? 'recipe' : 'ingredient'}>
            {isRecipe ? (
              <ChefHat aria-hidden="true" className="size-3" />
            ) : (
              <Leaf aria-hidden="true" className="size-3" />
            )}
            {isRecipe ? 'Recipe' : 'Ingredient'}
          </Badge>
        </div>

        <Field
          label={isRecipe ? `Recipe for ${position}` : `Ingredient for ${position}`}
          hideLabel
          error={errors?.target}
          className="min-w-48 flex-[3]"
        >
          {({ id, describedBy, invalid }) =>
            isRecipe ? (
              <Select
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                value={draft.targetId}
                onChange={(e) => onChange({ targetId: e.target.value })}
              >
                <option value="">Select an existing recipe…</option>
                {recipes.map((r) => {
                  const blocked = blockedRecipeIds.has(r.id);
                  return (
                    <option key={r.id} value={r.id} disabled={blocked}>
                      {r.name} ({r.servings} servings){blocked ? ' — would create a cycle' : ''}
                    </option>
                  );
                })}
              </Select>
            ) : (
              <div className="flex gap-2">
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  value={draft.targetId}
                  onChange={(e) => {
                    const ingredient = ingredients.find((i) => i.id === e.target.value);
                    onChange({
                      targetId: e.target.value,
                      ...(ingredient?.defaultUnit ? { unit: ingredient.defaultUnit } : {}),
                    });
                  }}
                >
                  <option value="">Select an ingredient…</option>
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  className={cn(iconButton, 'border border-stone-300 bg-white')}
                  aria-label="Create a new ingredient"
                  title="Create a new ingredient"
                  onClick={() => setCreatingIngredient(true)}
                >
                  <Plus aria-hidden="true" className="size-4" />
                </button>
              </div>
            )
          }
        </Field>

        <Field
          label={`Quantity for ${position}`}
          hideLabel
          error={errors?.quantity}
          className="w-28"
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={draft.quantity}
              placeholder="Qty"
              onChange={(e) => onChange({ quantity: e.target.value })}
            />
          )}
        </Field>

        <Field label={`Unit for ${position}`} hideLabel error={errors?.unit} className="w-32">
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={draft.unit}
              onChange={(e) => onChange({ unit: e.target.value })}
            >
              {isRecipe
                ? units.recipeUnits.map((u) => (
                    <option key={u} value={u}>
                      {u === 'batch' ? '× batch' : 'servings'}
                    </option>
                  ))
                : units.ingredientUnits.map((u) => (
                    <option key={u.code} value={u.code}>
                      {u.code}
                    </option>
                  ))}
            </Select>
          )}
        </Field>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className={iconButton}
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label={`Move ${position} up`}
          >
            <ArrowUp aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            className={iconButton}
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            aria-label={`Move ${position} down`}
          >
            <ArrowDown aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            className={cn(iconButton, 'hover:bg-red-50 hover:text-red-600')}
            onClick={onRemove}
            aria-label={`Remove ${position}`}
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      {isRecipe && (
        <p className="mt-2 text-xs text-stone-500">
          “× batch” multiplies the whole sub-recipe; “servings” uses that many servings of it
          (scaled by its yield).
        </p>
      )}

      {creatingIngredient && (
        <NewIngredientInline
          units={units.ingredientUnits}
          onCancel={() => setCreatingIngredient(false)}
          onCreated={(ingredient) => {
            setCreatingIngredient(false);
            onChange({ targetId: ingredient.id, unit: ingredient.defaultUnit ?? draft.unit });
          }}
        />
      )}
    </li>
  );
}
