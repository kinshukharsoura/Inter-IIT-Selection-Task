import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Db } from '../../src/lib/prisma';
import { loadRecipeGraph } from '../../src/services/recipeGraph.service';
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

let user: TestUser;
const ingredients: Record<string, string> = {};

beforeEach(async () => {
  await resetDatabase();
  user = await registerUser();
  for (const [name, unit] of [
    ['Flour', 'g'],
    ['Water', 'ml'],
    ['Yeast', 'g'],
    ['Tomatoes', 'g'],
    ['Garlic', 'g'],
    ['Cheese', 'g'],
    ['Salt', 'g'],
  ] as const) {
    ingredients[name] = await createIngredient(user, name, unit);
  }
});
afterAll(() => prisma.$disconnect());

const id = (name: string) => ingredients[name] as string;

async function totals(recipeId: string, servings?: number) {
  const res = await api()
    .get(`/api/recipes/${recipeId}/ingredients`)
    .query(servings ? { servings } : {})
    .set(user.auth);
  expect(res.status).toBe(200);
  return Object.fromEntries(
    (res.body.data.ingredients as { name: string; quantity: number; unit: string }[]).map((t) => [
      `${t.name} ${t.unit}`,
      t.quantity,
    ]),
  );
}

describe('GET /api/recipes/:id/ingredients (total ingredient expansion)', () => {
  it('Recipe A = 2 × Recipe B (100 g Flour) → 200 g Flour', async () => {
    const b = await createRecipe(user, 'B', 1, [ingredientLine(id('Flour'), 100)]);
    const a = await createRecipe(user, 'A', 1, [recipeLine(b, 2)]);
    expect(await totals(a)).toEqual({ 'Flour g': 200 });
  });

  it('produces the Pizza example from the specification', async () => {
    const dough = await createRecipe(user, 'Pizza Dough', 1, [
      ingredientLine(id('Flour'), 300),
      ingredientLine(id('Water'), 200, 'ml'),
      ingredientLine(id('Yeast'), 5),
    ]);
    const sauce = await createRecipe(user, 'Pizza Sauce', 1, [
      ingredientLine(id('Tomatoes'), 200),
      ingredientLine(id('Garlic'), 10),
    ]);
    const pizza = await createRecipe(user, 'Pizza', 1, [
      recipeLine(dough),
      recipeLine(sauce),
      ingredientLine(id('Cheese'), 150),
    ]);
    expect(await totals(pizza)).toEqual({
      'Flour g': 300,
      'Water ml': 200,
      'Yeast g': 5,
      'Tomatoes g': 200,
      'Garlic g': 10,
      'Cheese g': 150,
    });
  });

  it('scales by servings: 8 servings of a 4-serving Tomato Sauce (500 g) → 1000 g', async () => {
    const sauce = await createRecipe(user, 'Tomato Sauce', 4, [
      ingredientLine(id('Tomatoes'), 500),
    ]);
    const pasta = await createRecipe(user, 'Pasta', 8, [recipeLine(sauce, 8, 'serving')]);
    expect(await totals(pasta)).toEqual({ 'Tomatoes g': 1000 });
    // ...and the root can be rescaled: half the pasta → half the tomatoes
    expect(await totals(pasta, 4)).toEqual({ 'Tomatoes g': 500 });
    // Scaling the sauce itself
    expect(await totals(sauce, 8)).toEqual({ 'Tomatoes g': 1000 });
  });

  it('expands deep nesting A → B → C → D → E', async () => {
    const e = await createRecipe(user, 'E', 1, [ingredientLine(id('Salt'), 1)]);
    const d = await createRecipe(user, 'D', 1, [recipeLine(e, 2)]);
    const c = await createRecipe(user, 'C', 1, [recipeLine(d, 2)]);
    const b = await createRecipe(user, 'B', 1, [recipeLine(c, 2)]);
    const a = await createRecipe(user, 'A', 1, [recipeLine(b, 2)]);
    expect(await totals(a)).toEqual({ 'Salt g': 16 });
  });

  it('aggregates ingredients used in several branches', async () => {
    const dough = await createRecipe(user, 'Dough', 1, [ingredientLine(id('Flour'), 1, 'kg')]);
    const roux = await createRecipe(user, 'Roux', 1, [ingredientLine(id('Flour'), 50)]);
    const dish = await createRecipe(user, 'Dish', 1, [
      recipeLine(dough),
      recipeLine(roux),
      ingredientLine(id('Flour'), 250),
    ]);
    expect(await totals(dish)).toEqual({ 'Flour g': 1300 });
  });

  it('validates the servings query parameter', async () => {
    const b = await createRecipe(user, 'B', 1, [ingredientLine(id('Flour'), 100)]);
    for (const servings of ['0', '-2', 'abc']) {
      const res = await api()
        .get(`/api/recipes/${b}/ingredients`)
        .query({ servings })
        .set(user.auth);
      expect(res.status).toBe(400);
    }
  });
});

describe('GET /api/recipes/:id/tree (recursive structure)', () => {
  it('returns the nested Lasagna tree with scaled quantities', async () => {
    const tomatoSauce = await createRecipe(user, 'Tomato Sauce', 4, [
      ingredientLine(id('Tomatoes'), 500),
      ingredientLine(id('Garlic'), 20),
    ]);
    const bolognese = await createRecipe(user, 'Bolognese Sauce', 4, [recipeLine(tomatoSauce)]);
    const lasagna = await createRecipe(user, 'Lasagna', 4, [
      ingredientLine(id('Flour'), 300),
      recipeLine(bolognese),
      ingredientLine(id('Cheese'), 200),
    ]);

    const res = await api()
      .get(`/api/recipes/${lasagna}/tree`)
      .query({ servings: 8 })
      .set(user.auth);
    expect(res.status).toBe(200);
    const tree = res.body.data;
    expect(tree).toMatchObject({
      type: 'recipe',
      name: 'Lasagna',
      servings: 4,
      scaleFactor: 2,
      yieldServings: 8,
      depth: 0,
    });
    expect(tree.children.map((c: { type: string; name: string }) => `${c.type}:${c.name}`)).toEqual(
      ['ingredient:Flour', 'recipe:Bolognese Sauce', 'ingredient:Cheese'],
    );
    const tomato = tree.children[1].children[0];
    expect(tomato).toMatchObject({
      type: 'recipe',
      name: 'Tomato Sauce',
      depth: 2,
      scaleFactor: 2,
    });
    expect(tomato.children[0]).toMatchObject({
      type: 'ingredient',
      name: 'Tomatoes',
      quantity: 1000,
      baseQuantity: 500,
      unit: 'g',
    });
  });

  it('loads deep trees with a constant number of queries (no N+1)', async () => {
    let child = await createRecipe(user, 'L0', 1, [ingredientLine(id('Salt'), 1)]);
    for (let i = 1; i <= 15; i += 1)
      child = await createRecipe(user, `L${i}`, 1, [recipeLine(child)]);

    const res = await api().get(`/api/recipes/${child}/tree`).set(user.auth);
    expect(res.status).toBe(200);
    let depth = 0;
    for (let node = res.body.data; node.children?.length; node = node.children[0]) depth += 1;
    expect(depth).toBe(16);

    // The graph loader issues exactly 2 queries regardless of depth.
    const calls = { raw: 0, findMany: 0 };
    const countingDb = {
      $queryRaw: (...args: Parameters<typeof prisma.$queryRaw>) => {
        calls.raw += 1;
        return prisma.$queryRaw(...args);
      },
      recipe: {
        findMany: (args: Parameters<typeof prisma.recipe.findMany>[0]) => {
          calls.findMany += 1;
          return prisma.recipe.findMany(args);
        },
      },
    } as unknown as Db;
    const graph = await loadRecipeGraph(countingDb, [child]);
    expect(graph.size).toBe(16);
    expect(calls).toEqual({ raw: 1, findMany: 1 });
  });
});

describe('POST /api/recipes/:id/duplicate and POST /api/shopping-list', () => {
  it('duplicates a recipe, referencing (not copying) its sub-recipes', async () => {
    const sauce = await createRecipe(user, 'Sauce', 2, [ingredientLine(id('Tomatoes'), 100)]);
    const pizza = await createRecipe(user, 'Pizza', 2, [
      recipeLine(sauce),
      ingredientLine(id('Cheese'), 50),
    ]);

    const first = await api().post(`/api/recipes/${pizza}/duplicate`).set(user.auth).send({});
    expect(first.status).toBe(201);
    expect(first.body.data.name).toBe('Pizza (copy)');
    expect(first.body.data.components).toHaveLength(2);
    expect(first.body.data.components[0].recipe.id).toBe(sauce);

    const second = await api().post(`/api/recipes/${pizza}/duplicate`).set(user.auth).send({});
    expect(second.body.data.name).toBe('Pizza (copy 2)');
    expect(await totals(second.body.data.id)).toEqual(await totals(pizza));
  });

  it('builds a combined, scaled shopping list', async () => {
    const sauce = await createRecipe(user, 'Sauce', 4, [ingredientLine(id('Tomatoes'), 400)]);
    const bread = await createRecipe(user, 'Bread', 2, [ingredientLine(id('Flour'), 500)]);
    const pizza = await createRecipe(user, 'Pizza', 2, [
      recipeLine(sauce),
      ingredientLine(id('Flour'), 200),
    ]);

    const res = await api()
      .post('/api/shopping-list')
      .set(user.auth)
      .send({ items: [{ recipeId: pizza, servings: 4 }, { recipeId: bread }] });
    expect(res.status).toBe(200);
    const list = Object.fromEntries(
      res.body.data.ingredients.map((i: { name: string; quantity: number }) => [
        i.name,
        i.quantity,
      ]),
    );
    expect(list).toEqual({ Tomatoes: 800, Flour: 900 });
  });
});
