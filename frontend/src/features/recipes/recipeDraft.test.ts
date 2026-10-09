import { describe, expect, it } from 'vitest';
import type { RecipeDetail } from '../../api/types';
import {
  draftFromRecipe,
  draftToInput,
  emptyDraft,
  hasErrors,
  moveItem,
  newComponentDraft,
  validateDraft,
} from './recipeDraft';

describe('validateDraft', () => {
  it('requires a name and a positive whole number of servings', () => {
    const errors = validateDraft({ ...emptyDraft(), name: '  ', servings: '0' });
    expect(errors.name).toBeDefined();
    expect(errors.servings).toBeDefined();
    expect(validateDraft({ ...emptyDraft(), name: 'X', servings: '2.5' }).servings).toBeDefined();
    expect(hasErrors(validateDraft({ ...emptyDraft(), name: 'Soup', servings: '4' }))).toBe(false);
  });

  it('requires a target and a positive quantity for each component', () => {
    const component = { ...newComponentDraft('ingredient'), quantity: '-1' };
    const errors = validateDraft({ ...emptyDraft(), name: 'Soup', components: [component] });
    expect(errors.components[component.key]).toEqual({
      target: 'Choose an ingredient',
      quantity: 'Must be greater than 0',
    });
  });
});

describe('draftToInput', () => {
  it('converts the form state to the API payload', () => {
    const ing = {
      ...newComponentDraft('ingredient'),
      targetId: 'ing-1',
      quantity: '250',
      unit: 'g',
    };
    const sub = {
      ...newComponentDraft('recipe'),
      id: 'c-2',
      targetId: 'rec-1',
      quantity: '8',
      unit: 'serving',
    };
    const input = draftToInput({
      name: '  Pizza ',
      description: '',
      category: 'Italian',
      servings: '2',
      components: [ing, sub],
    });
    expect(input).toEqual({
      name: 'Pizza',
      description: null,
      category: 'Italian',
      servings: 2,
      components: [
        { type: 'ingredient', ingredientId: 'ing-1', quantity: 250, unit: 'g' },
        { id: 'c-2', type: 'recipe', recipeId: 'rec-1', quantity: 8, unit: 'serving' },
      ],
    });
  });

  it('round-trips an existing recipe', () => {
    const recipe: RecipeDetail = {
      id: 'r1',
      name: 'Pizza',
      description: null,
      category: null,
      servings: 2,
      createdAt: '',
      updatedAt: '',
      componentCount: 1,
      usedInCount: 0,
      usedIn: [],
      components: [
        {
          id: 'c1',
          type: 'recipe',
          position: 0,
          quantity: 2,
          unit: 'batch',
          ingredient: null,
          recipe: { id: 'r2', name: 'Sauce', servings: 4 },
        },
      ],
    };
    expect(draftToInput(draftFromRecipe(recipe)).components).toEqual([
      { id: 'c1', type: 'recipe', recipeId: 'r2', quantity: 2, unit: 'batch' },
    ]);
  });
});

describe('moveItem', () => {
  it('moves items and ignores out-of-range moves', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });
});
