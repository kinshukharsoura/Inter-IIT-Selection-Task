import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';

export const app = createApp();
export const api = () => request(app);

export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE recipe_components, recipes, ingredients, users RESTART IDENTITY CASCADE',
  );
}

let userCounter = 0;

export interface TestUser {
  id: string;
  email: string;
  token: string;
  auth: { Authorization: string };
}

export async function registerUser(name = 'Test User'): Promise<TestUser> {
  userCounter += 1;
  const email = `user${userCounter}-${Date.now()}@example.com`;
  const res = await api().post('/api/auth/register').send({ name, email, password: 'password123' });
  if (res.status !== 201)
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const { user, token } = res.body.data;
  return { id: user.id, email, token, auth: { Authorization: `Bearer ${token}` } };
}

export async function createIngredient(
  user: TestUser,
  name: string,
  defaultUnit = 'g',
): Promise<string> {
  const res = await api().post('/api/ingredients').set(user.auth).send({ name, defaultUnit });
  if (res.status !== 201)
    throw new Error(`ingredient failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.id;
}

type ComponentSpec =
  | { type: 'ingredient'; ingredientId: string; quantity: number; unit: string }
  | { type: 'recipe'; recipeId: string; quantity: number; unit?: 'batch' | 'serving' };

export async function createRecipe(
  user: TestUser,
  name: string,
  servings = 1,
  components: ComponentSpec[] = [],
): Promise<string> {
  const res = await api().post('/api/recipes').set(user.auth).send({ name, servings, components });
  if (res.status !== 201)
    throw new Error(`recipe failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.id;
}

export const ingredientLine = (
  ingredientId: string,
  quantity: number,
  unit = 'g',
): ComponentSpec => ({
  type: 'ingredient',
  ingredientId,
  quantity,
  unit,
});

export const recipeLine = (
  recipeId: string,
  quantity = 1,
  unit: 'batch' | 'serving' = 'batch',
): ComponentSpec => ({
  type: 'recipe',
  recipeId,
  quantity,
  unit,
});

export async function addRecipeComponent(
  user: TestUser,
  parentId: string,
  childId: string,
  quantity = 1,
) {
  return api()
    .post(`/api/recipes/${parentId}/components`)
    .set(user.auth)
    .send({ type: 'recipe', recipeId: childId, quantity, unit: 'batch' });
}

export { prisma };
