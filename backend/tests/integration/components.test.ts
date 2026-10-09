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
let sugar: string;
let bread: string;

beforeEach(async () => {
  await resetDatabase();
  alice = await registerUser('Alice');
  bob = await registerUser('Bob');
  flour = await createIngredient(alice, 'Flour');
  sugar = await createIngredient(alice, 'Sugar');
  bread = await createRecipe(alice, 'Bread', 2, [ingredientLine(flour, 500)]);
});
afterAll(() => prisma.$disconnect());

const componentsOf = async (recipeId: string) =>
  (await api().get(`/api/recipes/${recipeId}`).set(alice.auth)).body.data.components as {
    id: string;
    position: number;
    quantity: number;
    unit: string;
    type: string;
  }[];

describe('POST /api/recipes/:id/components', () => {
  it('appends an ingredient component', async () => {
    const res = await api()
      .post(`/api/recipes/${bread}/components`)
      .set(alice.auth)
      .send(ingredientLine(sugar, 20));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      type: 'ingredient',
      quantity: 20,
      unit: 'g',
      position: 1,
      ingredient: { name: 'Sugar' },
    });
  });

  it('appends an existing recipe as a component (default unit: batch)', async () => {
    const sandwich = await createRecipe(alice, 'Sandwich', 1);
    const res = await api()
      .post(`/api/recipes/${sandwich}/components`)
      .set(alice.auth)
      .send({ type: 'recipe', recipeId: bread, quantity: 0.5 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      type: 'recipe',
      quantity: 0.5,
      unit: 'batch',
      recipe: { id: bread, name: 'Bread' },
    });
  });

  it('validates the component body', async () => {
    const cases = [
      { type: 'ingredient', ingredientId: sugar, quantity: 0, unit: 'g' },
      { type: 'ingredient', ingredientId: sugar, quantity: 1 },
      { type: 'ingredient', ingredientId: randomUUID(), quantity: 1, unit: 'g' },
      { type: 'recipe', recipeId: randomUUID(), quantity: 1 },
      { type: 'recipe', quantity: 1 },
      {},
    ];
    for (const body of cases) {
      const res = await api().post(`/api/recipes/${bread}/components`).set(alice.auth).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it("returns 404 for an unknown recipe and 403 for someone else's", async () => {
    expect(
      (
        await api()
          .post(`/api/recipes/${randomUUID()}/components`)
          .set(alice.auth)
          .send(ingredientLine(sugar, 1))
      ).status,
    ).toBe(404);
    expect(
      (
        await api()
          .post(`/api/recipes/${bread}/components`)
          .set(bob.auth)
          .send(ingredientLine(sugar, 1))
      ).status,
    ).toBe(403);
  });
});

describe('PUT /api/recipes/:id/components/:componentId', () => {
  it('updates quantity and unit', async () => {
    const [component] = await componentsOf(bread);
    const res = await api()
      .put(`/api/recipes/${bread}/components/${component?.id}`)
      .set(alice.auth)
      .send({ quantity: 0.75, unit: 'kg' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ quantity: 0.75, unit: 'kg' });
  });

  it('rejects a recipe unit on an ingredient line and vice versa', async () => {
    const [ingredientComponent] = await componentsOf(bread);
    expect(
      (
        await api()
          .put(`/api/recipes/${bread}/components/${ingredientComponent?.id}`)
          .set(alice.auth)
          .send({ unit: 'batch' })
      ).status,
    ).toBe(400);

    const sandwich = await createRecipe(alice, 'Sandwich', 1, [recipeLine(bread)]);
    const [recipeComponent] = await componentsOf(sandwich);
    expect(
      (
        await api()
          .put(`/api/recipes/${sandwich}/components/${recipeComponent?.id}`)
          .set(alice.auth)
          .send({ unit: 'g' })
      ).status,
    ).toBe(400);
    const ok = await api()
      .put(`/api/recipes/${sandwich}/components/${recipeComponent?.id}`)
      .set(alice.auth)
      .send({ unit: 'serving', quantity: 1 });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ unit: 'serving', quantity: 1 });
  });

  it('moves a component to a new position', async () => {
    await api()
      .post(`/api/recipes/${bread}/components`)
      .set(alice.auth)
      .send(ingredientLine(sugar, 10));
    const [first, second] = await componentsOf(bread);
    const res = await api()
      .put(`/api/recipes/${bread}/components/${second?.id}`)
      .set(alice.auth)
      .send({ position: 0 });
    expect(res.status).toBe(200);
    const after = await componentsOf(bread);
    expect(after.map((c) => c.id)).toEqual([second?.id, first?.id]);
    expect(after.map((c) => c.position)).toEqual([0, 1]);
  });

  it('rejects invalid quantities and component ids', async () => {
    const [component] = await componentsOf(bread);
    expect(
      (
        await api()
          .put(`/api/recipes/${bread}/components/${component?.id}`)
          .set(alice.auth)
          .send({ quantity: -1 })
      ).status,
    ).toBe(400);
    expect(
      (
        await api()
          .put(`/api/recipes/${bread}/components/${randomUUID()}`)
          .set(alice.auth)
          .send({ quantity: 1 })
      ).status,
    ).toBe(404);
    expect(
      (
        await api()
          .put(`/api/recipes/${bread}/components/not-a-uuid`)
          .set(alice.auth)
          .send({ quantity: 1 })
      ).status,
    ).toBe(400);
  });

  it('rejects a component id that belongs to a different recipe', async () => {
    const other = await createRecipe(alice, 'Cake', 1, [ingredientLine(sugar, 100)]);
    const [otherComponent] = await componentsOf(other);
    const res = await api()
      .put(`/api/recipes/${bread}/components/${otherComponent?.id}`)
      .set(alice.auth)
      .send({ quantity: 1 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/recipes/:id/components/:componentId', () => {
  it('removes the component and compacts positions', async () => {
    await api()
      .post(`/api/recipes/${bread}/components`)
      .set(alice.auth)
      .send(ingredientLine(sugar, 10));
    const [first, second] = await componentsOf(bread);
    const res = await api().delete(`/api/recipes/${bread}/components/${first?.id}`).set(alice.auth);
    expect(res.status).toBe(200);
    const after = await componentsOf(bread);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ id: second?.id, position: 0 });
  });

  it('removing a recipe component does not delete the referenced recipe', async () => {
    const sandwich = await createRecipe(alice, 'Sandwich', 1, [recipeLine(bread)]);
    const [component] = await componentsOf(sandwich);
    await api().delete(`/api/recipes/${sandwich}/components/${component?.id}`).set(alice.auth);
    expect((await api().get(`/api/recipes/${bread}`).set(alice.auth)).status).toBe(200);
  });

  it('is forbidden for other users', async () => {
    const [component] = await componentsOf(bread);
    expect(
      (await api().delete(`/api/recipes/${bread}/components/${component?.id}`).set(bob.auth))
        .status,
    ).toBe(403);
  });
});

describe('PUT /api/recipes/:id/components/order', () => {
  it('reorders all components', async () => {
    await api()
      .post(`/api/recipes/${bread}/components`)
      .set(alice.auth)
      .send(ingredientLine(sugar, 10));
    const [a, b] = await componentsOf(bread);
    const res = await api()
      .put(`/api/recipes/${bread}/components/order`)
      .set(alice.auth)
      .send({ componentIds: [b?.id, a?.id] });
    expect(res.status).toBe(200);
    expect(res.body.data.map((c: { id: string }) => c.id)).toEqual([b?.id, a?.id]);
  });

  it('requires an exact permutation of the component ids', async () => {
    const [a] = await componentsOf(bread);
    const res = await api()
      .put(`/api/recipes/${bread}/components/order`)
      .set(alice.auth)
      .send({ componentIds: [a?.id, a?.id] });
    expect(res.status).toBe(400);
  });
});
