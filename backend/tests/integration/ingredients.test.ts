import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { importDataset, readDatasetFromDir } from '../../src/scripts/importDataset';
import {
  api,
  createIngredient,
  createRecipe,
  ingredientLine,
  prisma,
  registerUser,
  resetDatabase,
  TestUser,
} from './helpers';

let alice: TestUser;
let bob: TestUser;

beforeEach(async () => {
  await resetDatabase();
  alice = await registerUser('Alice');
  bob = await registerUser('Bob');
});
afterAll(() => prisma.$disconnect());

describe('ingredients', () => {
  it('creates, lists (with search), updates and deletes an ingredient', async () => {
    const created = await api()
      .post('/api/ingredients')
      .set(alice.auth)
      .send({ name: 'Saffron', description: 'Expensive', defaultUnit: 'g' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      name: 'Saffron',
      defaultUnit: 'g',
      editable: true,
      usageCount: 0,
    });
    const id = created.body.data.id;

    const list = await api().get('/api/ingredients').query({ search: 'saff' }).set(bob.auth);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].editable).toBe(false); // shared catalogue, but only the creator may edit

    const updated = await api()
      .put(`/api/ingredients/${id}`)
      .set(alice.auth)
      .send({ name: 'Saffron Threads' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe('Saffron Threads');

    expect((await api().delete(`/api/ingredients/${id}`).set(alice.auth)).status).toBe(200);
    expect((await api().get(`/api/ingredients/${id}`).set(alice.auth)).status).toBe(404);
  });

  it('rejects duplicate names case-insensitively', async () => {
    await createIngredient(alice, 'Tomato');
    const res = await api().post('/api/ingredients').set(bob.auth).send({ name: 'tomato' });
    expect(res.status).toBe(409);
  });

  it('only lets the creator modify an ingredient', async () => {
    const id = await createIngredient(alice, 'Basil');
    expect(
      (await api().put(`/api/ingredients/${id}`).set(bob.auth).send({ name: 'X' })).status,
    ).toBe(403);
    expect((await api().delete(`/api/ingredients/${id}`).set(bob.auth)).status).toBe(403);
  });

  it("prevents renaming an ingredient used in other users' recipes", async () => {
    const id = await createIngredient(alice, 'Basil');
    await createRecipe(bob, 'Bob Pesto', 1, [ingredientLine(id, 10)]);
    const res = await api().put(`/api/ingredients/${id}`).set(alice.auth).send({ name: 'Arsenic' });
    expect(res.status).toBe(409);
    // Alice can still rename it while only her own recipes use it.
    const mine = await createIngredient(alice, 'Thyme');
    await createRecipe(alice, 'Alice Stew', 1, [ingredientLine(mine, 1)]);
    expect(
      (await api().put(`/api/ingredients/${mine}`).set(alice.auth).send({ name: 'Fresh Thyme' }))
        .status,
    ).toBe(200);
  });

  it('prevents deleting an ingredient that is used in a recipe (409)', async () => {
    const id = await createIngredient(alice, 'Flour');
    await createRecipe(alice, 'Bread', 1, [ingredientLine(id, 100)]);
    const res = await api().delete(`/api/ingredients/${id}`).set(alice.auth);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/used in 1 recipe component/);
  });

  it('validates input', async () => {
    expect((await api().post('/api/ingredients').set(alice.auth).send({ name: '' })).status).toBe(
      400,
    );
    expect(
      (
        await api()
          .post('/api/ingredients')
          .set(alice.auth)
          .send({ name: 'X', defaultUnit: 'bucket' })
      ).status,
    ).toBe(400);
  });

  it('exposes the supported units', async () => {
    const res = await api().get('/api/units').set(alice.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.recipeUnits).toEqual(['batch', 'serving']);
    expect(res.body.data.ingredientUnits.map((u: { code: string }) => u.code)).toContain('g');
  });
});

describe('dataset import (seed)', () => {
  it('imports the provided dataset idempotently with a working recursive structure', async () => {
    const dataset = readDatasetFromDir(path.resolve(__dirname, '../../prisma/data'));
    const first = await importDataset(prisma, alice.id, dataset);
    const second = await importDataset(prisma, alice.id, dataset);
    expect(second).toEqual(first);
    expect(await prisma.recipe.count({ where: { userId: alice.id } })).toBe(dataset.recipes.length);
    expect(await prisma.ingredient.count()).toBe(dataset.ingredients.length);

    const recipes = (
      await api().get('/api/recipes').query({ search: 'Grand Feast' }).set(alice.auth)
    ).body.data;
    const grandFeast = recipes.find((r: { name: string }) => r.name === 'Grand Feast');
    const tree = await api().get(`/api/recipes/${grandFeast.id}/tree`).set(alice.auth);
    expect(tree.status).toBe(200);
    const totals = await api().get(`/api/recipes/${grandFeast.id}/ingredients`).set(alice.auth);
    expect(totals.status).toBe(200);
    expect(totals.body.data.ingredients.length).toBeGreaterThan(10);

    // Dataset ingredients are system-owned and read-only.
    const tomato = (await api().get('/api/ingredients').query({ search: 'Tomato' }).set(alice.auth))
      .body.data[0];
    expect(tomato.editable).toBe(false);
  });
});
