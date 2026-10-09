import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  createIngredient,
  createRecipe,
  ingredientLine,
  prisma,
  recipeLine,
  registerUser,
  resetDatabase,
  TestUser,
} from './helpers';

let alice: TestUser;
let bob: TestUser;
let flour: string;
let tomato: string;

beforeEach(async () => {
  await resetDatabase();
  alice = await registerUser('Alice');
  bob = await registerUser('Bob');
  flour = await createIngredient(alice, 'Flour');
  tomato = await createIngredient(alice, 'Tomato');
});
afterAll(() => prisma.$disconnect());

describe('recipe CRUD', () => {
  it('creates a recipe with ingredient and recipe components', async () => {
    const sauce = await createRecipe(alice, 'Tomato Sauce', 4, [ingredientLine(tomato, 500)]);
    const res = await api()
      .post('/api/recipes')
      .set(alice.auth)
      .send({
        name: '  Pizza  ',
        description: 'Classic',
        category: 'Italian',
        servings: 2,
        components: [ingredientLine(flour, 300), recipeLine(sauce, 1)],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Pizza',
      description: 'Classic',
      category: 'Italian',
      servings: 2,
      componentCount: 2,
      usedInCount: 0,
    });
    expect(res.body.data.components).toEqual([
      expect.objectContaining({
        type: 'ingredient',
        position: 0,
        quantity: 300,
        unit: 'g',
        ingredient: { id: flour, name: 'Flour' },
      }),
      expect.objectContaining({
        type: 'recipe',
        position: 1,
        quantity: 1,
        unit: 'batch',
        recipe: { id: sauce, name: 'Tomato Sauce', servings: 4 },
      }),
    ]);
  });

  it('does not copy the ingredients of a reused recipe', async () => {
    const sauce = await createRecipe(alice, 'Tomato Sauce', 4, [ingredientLine(tomato, 500)]);
    await createRecipe(alice, 'Pizza', 2, [recipeLine(sauce)]);
    await createRecipe(alice, 'Pasta', 2, [recipeLine(sauce)]);
    expect(await prisma.recipeComponent.count({ where: { ingredientId: tomato } })).toBe(1);
    expect(await prisma.recipeComponent.count({ where: { childRecipeId: sauce } })).toBe(2);
  });

  it("lists only the current user's recipes, with search and category filters", async () => {
    await createRecipe(alice, 'Tomato Soup', 2, [ingredientLine(tomato, 100)]);
    await createRecipe(alice, 'Bread', 2, [ingredientLine(flour, 100)]);
    await createRecipe(bob, 'Bob Secret', 1);

    const all = await api().get('/api/recipes').set(alice.auth);
    expect(all.status).toBe(200);
    expect(all.body.data.map((r: { name: string }) => r.name).sort()).toEqual([
      'Bread',
      'Tomato Soup',
    ]);
    expect(all.body.meta).toEqual({ count: 2 });

    const byName = await api().get('/api/recipes').query({ search: 'soup' }).set(alice.auth);
    expect(byName.body.data.map((r: { name: string }) => r.name)).toEqual(['Tomato Soup']);

    // Dependency search: matches recipes that use the ingredient.
    const byIngredient = await api().get('/api/recipes').query({ search: 'flour' }).set(alice.auth);
    expect(byIngredient.body.data.map((r: { name: string }) => r.name)).toEqual(['Bread']);
  });

  it('gets a recipe by id', async () => {
    const id = await createRecipe(alice, 'Bread', 2, [ingredientLine(flour, 500)]);
    const res = await api().get(`/api/recipes/${id}`).set(alice.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id, name: 'Bread', servings: 2, usedIn: [] });
  });

  it('updates fields and replaces/syncs the component list', async () => {
    const id = await createRecipe(alice, 'Bread', 2, [
      ingredientLine(flour, 500),
      ingredientLine(tomato, 1),
    ]);
    const before = (await api().get(`/api/recipes/${id}`).set(alice.auth)).body.data;
    const flourComponent = before.components[0];

    const res = await api()
      .put(`/api/recipes/${id}`)
      .set(alice.auth)
      .send({
        name: 'Better Bread',
        servings: 4,
        description: '',
        components: [
          {
            id: flourComponent.id,
            type: 'ingredient',
            ingredientId: flour,
            quantity: 600,
            unit: 'g',
          },
          { type: 'ingredient', ingredientId: tomato, quantity: 2, unit: 'piece' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Better Bread', servings: 4, description: null });
    expect(res.body.data.components).toHaveLength(2);
    expect(res.body.data.components[0]).toMatchObject({ id: flourComponent.id, quantity: 600 });
    expect(res.body.data.components[1]).toMatchObject({ quantity: 2, unit: 'piece' });
    expect(res.body.data.components[1].id).not.toBe(before.components[1].id);
  });

  it('rejects component ids that belong to another recipe', async () => {
    const other = await createRecipe(alice, 'Other', 1, [ingredientLine(flour, 1)]);
    const otherComponent = (await api().get(`/api/recipes/${other}`).set(alice.auth)).body.data
      .components[0];
    const id = await createRecipe(alice, 'Bread', 1);
    const res = await api()
      .put(`/api/recipes/${id}`)
      .set(alice.auth)
      .send({
        components: [
          {
            id: otherComponent.id,
            type: 'ingredient',
            ingredientId: flour,
            quantity: 1,
            unit: 'g',
          },
        ],
      });
    expect(res.status).toBe(400);
  });

  it('deletes a recipe and its components', async () => {
    const id = await createRecipe(alice, 'Bread', 2, [ingredientLine(flour, 500)]);
    const res = await api().delete(`/api/recipes/${id}`).set(alice.auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { id } });
    expect((await api().get(`/api/recipes/${id}`).set(alice.auth)).status).toBe(404);
    expect(await prisma.recipeComponent.count()).toBe(0);
  });

  it('prevents deleting a recipe that is used by another recipe (409)', async () => {
    const sauce = await createRecipe(alice, 'Tomato Sauce', 4, [ingredientLine(tomato, 500)]);
    const pizza = await createRecipe(alice, 'Pizza', 2, [recipeLine(sauce)]);

    const res = await api().delete(`/api/recipes/${sauce}`).set(alice.auth);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/used by: Pizza/);
    expect(res.body.errors.usedBy).toEqual([{ id: pizza, name: 'Pizza' }]);

    // After removing the parent the sauce can be deleted.
    expect((await api().delete(`/api/recipes/${pizza}`).set(alice.auth)).status).toBe(200);
    expect((await api().delete(`/api/recipes/${sauce}`).set(alice.auth)).status).toBe(200);
  });
});

describe('recipe validation', () => {
  it.each([
    [{ servings: 2 }, 'name'],
    [{ name: '   ', servings: 2 }, 'name'],
    [{ name: 'X', servings: 0 }, 'servings'],
    [{ name: 'X', servings: 2.5 }, 'servings'],
    [{ name: 'X', servings: -1 }, 'servings'],
    [{ name: 'X' }, 'servings'],
    [
      {
        name: 'X',
        servings: 1,
        components: [{ type: 'ingredient', ingredientId: 'nope', quantity: 1, unit: 'g' }],
      },
      'components.0.ingredientId',
    ],
    [{ name: 'X', servings: 1, components: [{ type: 'magic', quantity: 1 }] }, 'components.0.type'],
  ])('rejects %j (400)', async (body, path) => {
    const res = await api().post('/api/recipes').set(alice.auth).send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.map((e: { path: string }) => e.path)).toContain(path);
  });

  it.each([0, -5, 'abc', null])('rejects invalid component quantity %j', async (quantity) => {
    const res = await api()
      .post('/api/recipes')
      .set(alice.auth)
      .send({
        name: 'X',
        servings: 1,
        components: [{ type: 'ingredient', ingredientId: flour, quantity, unit: 'g' }],
      });
    expect(res.status).toBe(400);
  });

  it('rejects unsupported units', async () => {
    const bad = await api()
      .post('/api/recipes')
      .set(alice.auth)
      .send({
        name: 'X',
        servings: 1,
        components: [{ type: 'ingredient', ingredientId: flour, quantity: 1, unit: 'bucket' }],
      });
    expect(bad.status).toBe(400);

    const sauce = await createRecipe(alice, 'Sauce', 1);
    const badRecipeUnit = await api()
      .post('/api/recipes')
      .set(alice.auth)
      .send({
        name: 'Y',
        servings: 1,
        components: [{ type: 'recipe', recipeId: sauce, quantity: 1, unit: 'g' }],
      });
    expect(badRecipeUnit.status).toBe(400);
  });

  it('rejects references to ingredients or recipes that do not exist', async () => {
    const missingIngredient = await api()
      .post('/api/recipes')
      .set(alice.auth)
      .send({ name: 'X', servings: 1, components: [ingredientLine(randomUUID(), 1)] });
    expect(missingIngredient.status).toBe(400);
    expect(missingIngredient.body.message).toMatch(/Ingredient not found/);

    const missingRecipe = await api()
      .post('/api/recipes')
      .set(alice.auth)
      .send({ name: 'X', servings: 1, components: [recipeLine(randomUUID())] });
    expect(missingRecipe.status).toBe(400);
    expect(missingRecipe.body.message).toMatch(/Referenced recipe not found/);
  });

  it('rejects duplicate recipe names per user (case-insensitive) but allows them across users', async () => {
    await createRecipe(alice, 'Bread', 1);
    const dup = await api()
      .post('/api/recipes')
      .set(alice.auth)
      .send({ name: 'BREAD', servings: 1 });
    expect(dup.status).toBe(409);
    const other = await api()
      .post('/api/recipes')
      .set(bob.auth)
      .send({ name: 'Bread', servings: 1 });
    expect(other.status).toBe(201);
  });

  it('rejects malformed ids with 400 and unknown ids with 404', async () => {
    expect((await api().get('/api/recipes/not-a-uuid').set(alice.auth)).status).toBe(400);
    expect((await api().get(`/api/recipes/${randomUUID()}`).set(alice.auth)).status).toBe(404);
  });

  it('rejects an empty update', async () => {
    const id = await createRecipe(alice, 'Bread', 1);
    expect((await api().put(`/api/recipes/${id}`).set(alice.auth).send({})).status).toBe(400);
  });
});

describe('authorization', () => {
  it("forbids reading, updating and deleting another user's recipe (403)", async () => {
    const id = await createRecipe(alice, 'Private', 1, [ingredientLine(flour, 1)]);
    expect((await api().get(`/api/recipes/${id}`).set(bob.auth)).status).toBe(403);
    expect((await api().get(`/api/recipes/${id}/tree`).set(bob.auth)).status).toBe(403);
    expect((await api().get(`/api/recipes/${id}/ingredients`).set(bob.auth)).status).toBe(403);
    expect(
      (await api().put(`/api/recipes/${id}`).set(bob.auth).send({ name: 'Hacked' })).status,
    ).toBe(403);
    expect((await api().delete(`/api/recipes/${id}`).set(bob.auth)).status).toBe(403);
    expect((await api().post(`/api/recipes/${id}/duplicate`).set(bob.auth)).status).toBe(403);
    expect(
      (
        await api()
          .post(`/api/recipes/${id}/components`)
          .set(bob.auth)
          .send(ingredientLine(flour, 1))
      ).status,
    ).toBe(403);
    expect((await prisma.recipe.findUniqueOrThrow({ where: { id } })).name).toBe('Private');
  });

  it("forbids using another user's recipe as a component", async () => {
    const aliceSauce = await createRecipe(alice, 'Alice Sauce', 1);
    const res = await api()
      .post('/api/recipes')
      .set(bob.auth)
      .send({ name: 'Bob Pizza', servings: 1, components: [recipeLine(aliceSauce)] });
    expect(res.status).toBe(403);
  });
});
