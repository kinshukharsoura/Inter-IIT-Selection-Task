import { describe, expect, it } from 'vitest';
import { formatAmount, formatRecipeUsage, pluralize, totalsAsText } from './format';

describe('format helpers', () => {
  it('formats amounts and pluralises count units', () => {
    expect(formatAmount(300, 'g')).toBe('300 g');
    expect(formatAmount(0.333333, 'kg')).toBe('0.33 kg');
    expect(formatAmount(1, 'piece')).toBe('1 piece');
    expect(formatAmount(3, 'piece')).toBe('3 pieces');
    expect(formatAmount(2, 'pinch')).toBe('2 pinches');
  });

  it('describes how a sub-recipe is used', () => {
    expect(formatRecipeUsage(1, 'batch')).toBe('1 batch');
    expect(formatRecipeUsage(2, 'batch')).toBe('2 batches');
    expect(formatRecipeUsage(8, 'serving')).toBe('8 servings');
  });

  it('pluralises', () => {
    expect(pluralize(1, 'recipe')).toBe('1 recipe');
    expect(pluralize(0, 'recipe')).toBe('0 recipes');
  });

  it('renders a copyable text list', () => {
    expect(
      totalsAsText('Pizza', [
        { ingredientId: '1', name: 'Flour', quantity: 300, unit: 'g' },
        { ingredientId: '2', name: 'Water', quantity: 200, unit: 'ml' },
      ]),
    ).toBe('Pizza\n- Flour: 300 g\n- Water: 200 ml');
  });
});
