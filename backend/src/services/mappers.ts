import { Prisma } from '@prisma/client';

/** Prisma selection used whenever a component is returned by the API. */
export const componentSelect = {
  id: true,
  position: true,
  quantity: true,
  unit: true,
  ingredient: { select: { id: true, name: true } },
  childRecipe: { select: { id: true, name: true, servings: true } },
} satisfies Prisma.RecipeComponentSelect;

type ComponentRow = Prisma.RecipeComponentGetPayload<{ select: typeof componentSelect }>;

export interface ComponentDto {
  id: string;
  type: 'ingredient' | 'recipe';
  position: number;
  quantity: number;
  unit: string;
  ingredient: { id: string; name: string } | null;
  recipe: { id: string; name: string; servings: number } | null;
}

export function toComponentDto(row: ComponentRow): ComponentDto {
  return {
    id: row.id,
    type: row.childRecipe ? 'recipe' : 'ingredient',
    position: row.position,
    quantity: row.quantity,
    unit: row.unit,
    ingredient: row.ingredient,
    recipe: row.childRecipe,
  };
}
