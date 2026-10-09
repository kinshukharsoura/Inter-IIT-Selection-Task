import type { ComponentInput, ComponentType, RecipeDetail, RecipeInput } from '../../api/types';

/** Editable form state of one component (numbers kept as strings while typing). */
export interface ComponentDraft {
  /** Client-side key for React lists. */
  key: string;
  /** Server id of an existing component (edit mode). */
  id?: string;
  type: ComponentType;
  /** Ingredient id or recipe id, depending on `type`. */
  targetId: string;
  quantity: string;
  unit: string;
}

export interface RecipeDraft {
  name: string;
  description: string;
  category: string;
  servings: string;
  components: ComponentDraft[];
}

export interface DraftErrors {
  name?: string;
  servings?: string;
  components: Record<string, { target?: string; quantity?: string; unit?: string }>;
}

export const MAX_NAME_LENGTH = 120;
export const MAX_SERVINGS = 1000;

let keyCounter = 0;
export const newDraftKey = () => `draft-${(keyCounter += 1)}`;

export function emptyDraft(): RecipeDraft {
  return { name: '', description: '', category: '', servings: '4', components: [] };
}

export function newComponentDraft(
  type: ComponentType,
  defaultIngredientUnit = 'g',
): ComponentDraft {
  return {
    key: newDraftKey(),
    type,
    targetId: '',
    quantity: '1',
    unit: type === 'recipe' ? 'batch' : defaultIngredientUnit,
  };
}

export function draftFromRecipe(recipe: RecipeDetail): RecipeDraft {
  return {
    name: recipe.name,
    description: recipe.description ?? '',
    category: recipe.category ?? '',
    servings: String(recipe.servings),
    components: recipe.components.map((c) => ({
      key: newDraftKey(),
      id: c.id,
      type: c.type,
      targetId: (c.type === 'recipe' ? c.recipe?.id : c.ingredient?.id) ?? '',
      quantity: String(c.quantity),
      unit: c.unit,
    })),
  };
}

export function validateDraft(draft: RecipeDraft): DraftErrors {
  const errors: DraftErrors = { components: {} };
  const name = draft.name.trim();
  if (!name) errors.name = 'Name is required';
  else if (name.length > MAX_NAME_LENGTH)
    errors.name = `Name must be at most ${MAX_NAME_LENGTH} characters`;

  const servings = Number(draft.servings);
  if (
    !draft.servings.trim() ||
    !Number.isInteger(servings) ||
    servings < 1 ||
    servings > MAX_SERVINGS
  ) {
    errors.servings = `Servings must be a whole number between 1 and ${MAX_SERVINGS}`;
  }

  for (const c of draft.components) {
    const componentErrors: DraftErrors['components'][string] = {};
    if (!c.targetId)
      componentErrors.target = c.type === 'recipe' ? 'Choose a recipe' : 'Choose an ingredient';
    const quantity = Number(c.quantity);
    if (!c.quantity.trim() || !Number.isFinite(quantity) || quantity <= 0) {
      componentErrors.quantity = 'Must be greater than 0';
    }
    if (!c.unit) componentErrors.unit = 'Choose a unit';
    if (Object.keys(componentErrors).length > 0) errors.components[c.key] = componentErrors;
  }
  return errors;
}

export function hasErrors(errors: DraftErrors): boolean {
  return Boolean(errors.name || errors.servings || Object.keys(errors.components).length > 0);
}

export function draftToInput(draft: RecipeDraft): RecipeInput {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    category: draft.category.trim() || null,
    servings: Number(draft.servings),
    components: draft.components.map((c): ComponentInput => {
      const base = { ...(c.id ? { id: c.id } : {}), quantity: Number(c.quantity) };
      return c.type === 'recipe'
        ? {
            ...base,
            type: 'recipe',
            recipeId: c.targetId,
            unit: c.unit === 'serving' ? 'serving' : 'batch',
          }
        : { ...base, type: 'ingredient', ingredientId: c.targetId, unit: c.unit };
    }),
  };
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return next;
}
