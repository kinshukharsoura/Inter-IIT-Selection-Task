import type { IngredientTotal } from '../api/types';

const quantityFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export function formatQuantity(value: number): string {
  return quantityFormatter.format(value);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatQuantity(count)} ${count === 1 ? singular : plural}`;
}

/** "300 g", "2 piece" → "2 pieces" for count units. */
export function formatAmount(quantity: number, unit: string): string {
  const countUnits = new Set(['piece', 'clove', 'slice', 'pinch', 'bunch']);
  if (countUnits.has(unit))
    return pluralize(
      quantity,
      unit,
      unit === 'pinch' ? 'pinches' : unit === 'bunch' ? 'bunches' : `${unit}s`,
    );
  return `${formatQuantity(quantity)} ${unit}`;
}

/** How a sub-recipe is used by its parent: "2 batches", "8 servings". */
export function formatRecipeUsage(quantity: number, unit: string): string {
  return unit === 'serving'
    ? pluralize(quantity, 'serving')
    : pluralize(quantity, 'batch', 'batches');
}

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** Plain-text version of an ingredient list (for copying to the clipboard). */
export function totalsAsText(title: string, items: IngredientTotal[]): string {
  return [title, ...items.map((i) => `- ${i.name}: ${formatAmount(i.quantity, i.unit)}`)].join(
    '\n',
  );
}
