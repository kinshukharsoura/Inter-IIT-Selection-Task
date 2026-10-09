import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  addRecipeComponent,
  api,
  createRecipe,
  prisma,
  recipeLine,
  registerUser,
  resetDatabase,
  TestUser,
} from './helpers';

let user: TestUser;

beforeEach(async () => {
  await resetDatabase();
  user = await registerUser();
});
afterAll(() => prisma.$disconnect());

/** Creates a chain R0 → R1 → … → R(n-1) (R0 uses R1, etc.) and returns the ids. */
async function createChain(length: number): Promise<string[]> {
  const ids: string[] = [];
  let child: string | null = null;
  for (let i = length - 1; i >= 0; i -= 1) {
    const id: string = await createRecipe(user, `R${i}`, 1, child ? [recipeLine(child)] : []);
    ids.unshift(id);
    child = id;
  }
  return ids;
}

function expectCircularError(res: { status: number; body: { success: boolean; message: string } }) {
  expect(res.status).toBe(409);
  expect(res.body.success).toBe(false);
  expect(res.body.message).toMatch(/^Adding this recipe would create a circular dependency/);
}

describe('circular dependency prevention', () => {
  it('rejects self-reference A → A (component endpoint)', async () => {
    const a = await createRecipe(user, 'A');
    expectCircularError(await addRecipeComponent(user, a, a));
  });

  it('rejects self-reference A → A (full update endpoint)', async () => {
    const a = await createRecipe(user, 'A');
    const res = await api()
      .put(`/api/recipes/${a}`)
      .set(user.auth)
      .send({ components: [recipeLine(a)] });
    expectCircularError(res);
  });

  it('rejects A → B → A', async () => {
    const b = await createRecipe(user, 'B');
    const a = await createRecipe(user, 'A', 1, [recipeLine(b)]);
    const res = await addRecipeComponent(user, b, a);
    expectCircularError(res);
    expect(res.body.message).toContain('B → A → B');
  });

  it('rejects A → B → C → A', async () => {
    const [a, , c] = await createChain(3);
    const res = await addRecipeComponent(user, c as string, a as string);
    expectCircularError(res);
    expect(res.body.message).toContain('R2 → R0 → R1 → R2');
  });

  it('rejects closing a long dependency chain (25 levels)', async () => {
    const chain = await createChain(25);
    const res = await addRecipeComponent(user, chain.at(-1) as string, chain[0] as string);
    expectCircularError(res);
    expect((res.body as unknown as { errors: { cycle: string[] } }).errors.cycle).toHaveLength(26);
  });

  it('rejects a cycle introduced through PUT /api/recipes/:id', async () => {
    const [a, , c] = await createChain(3);
    const res = await api()
      .put(`/api/recipes/${c}`)
      .set(user.auth)
      .send({ components: [recipeLine(a as string)] });
    expectCircularError(res);
  });

  it('leaves the data unchanged after a rejected cycle', async () => {
    const [a, b] = await createChain(2);
    await addRecipeComponent(user, b as string, a as string);
    expect(await prisma.recipeComponent.count({ where: { recipeId: b } })).toBe(0);
  });

  it('allows reusing the same sub-recipe in several places (diamond, not a cycle)', async () => {
    const sauce = await createRecipe(user, 'Sauce');
    const pizza = await createRecipe(user, 'Pizza', 1, [recipeLine(sauce)]);
    const pasta = await createRecipe(user, 'Pasta', 1, [recipeLine(sauce)]);
    const feast = await api()
      .post('/api/recipes')
      .set(user.auth)
      .send({
        name: 'Feast',
        servings: 1,
        components: [recipeLine(pizza), recipeLine(pasta), recipeLine(sauce)],
      });
    expect(feast.status).toBe(201);
  });

  it('serialises concurrent writes so two requests cannot create a cycle together', async () => {
    const a = await createRecipe(user, 'A');
    const b = await createRecipe(user, 'B');
    const [r1, r2] = await Promise.all([
      addRecipeComponent(user, a, b),
      addRecipeComponent(user, b, a),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([201, 409]);
  });

  it('rejects nesting deeper than the supported maximum (422)', async () => {
    // Build the chain directly in the database (fast), then add one more level via the API.
    const { MAX_RECIPE_DEPTH } = await import('../../src/domain/recipeTree');
    const ids: string[] = [];
    for (let i = 0; i <= MAX_RECIPE_DEPTH; i += 1) {
      const r = await prisma.recipe.create({
        data: { userId: user.id, name: `Deep ${i}`, servings: 1 },
      });
      ids.push(r.id);
    }
    await prisma.recipeComponent.createMany({
      data: ids.slice(0, -1).map((id, i) => ({
        recipeId: id,
        childRecipeId: ids[i + 1] as string,
        quantity: 1,
        unit: 'batch',
        position: 0,
      })),
    });
    // ids[0] already has MAX_RECIPE_DEPTH levels below it; one more level is too deep.
    const top = await createRecipe(user, 'Too deep');
    const res = await addRecipeComponent(user, top, ids[0] as string);
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/nested at most/);
    // The deepest allowed recipe still expands.
    expect((await api().get(`/api/recipes/${ids[0]}/tree`).set(user.auth)).status).toBe(200);
  });

  it('reports the transitive users of a recipe (recipes that may not be added to it)', async () => {
    const [a, b, c] = await createChain(3);
    const res = await api().get(`/api/recipes/${c}/usages`).set(user.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.direct.map((r: { id: string }) => r.id)).toEqual([b]);
    expect(res.body.data.transitive.map((r: { id: string }) => r.id).sort()).toEqual([a, b].sort());
  });
});
