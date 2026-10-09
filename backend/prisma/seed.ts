/**
 * Seeds the database with a demo user and imports the provided dataset
 * (prisma/data/ingredients.json + recipes.json) into that user's account.
 *
 *   npm run db:seed
 *
 * Safe to run on every start-up: the dataset is imported only when the demo user
 * has no imported recipes yet, so later edits are never overwritten. Set
 * SEED_FORCE=true to re-import (re-sync) the dataset. Configurable through:
 *   SEED_DEMO_EMAIL     (default demo@recipes.local)
 *   SEED_DEMO_PASSWORD  (default Demo@12345 — a public demo credential, not a secret)
 *   SEED_DEMO_NAME      (default Demo Chef)
 *   DATASET_DIR         (default prisma/data)
 *   SEED_FORCE          (default false)
 */
import path from 'node:path';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { importDataset, readDatasetFromDir } from '../src/scripts/importDataset';

const DEFAULT_SALT_ROUNDS = 12;

async function main() {
  const prisma = new PrismaClient();
  try {
    const email = (process.env.SEED_DEMO_EMAIL ?? 'demo@recipes.local').toLowerCase();
    const password = process.env.SEED_DEMO_PASSWORD ?? 'Demo@12345';
    const name = process.env.SEED_DEMO_NAME ?? 'Demo Chef';
    const rounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? DEFAULT_SALT_ROUNDS);
    const datasetDir = path.resolve(process.cwd(), process.env.DATASET_DIR ?? 'prisma/data');

    const force = process.env.SEED_FORCE === 'true';

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const passwordHash = await bcrypt.hash(password, rounds);
      user = await prisma.user.create({ data: { email, name, passwordHash } });
    }

    const imported = await prisma.recipe.count({
      where: { userId: user.id, externalId: { not: null } },
    });
    if (imported > 0 && !force) {
      console.info(
        `Demo user ${email} already seeded (${imported} dataset recipes); skipping import.`,
      );
      return;
    }

    const summary = await importDataset(prisma, user.id, readDatasetFromDir(datasetDir));
    console.info(
      `Seeded demo user ${email} with ${summary.recipes} recipes, ` +
        `${summary.ingredients} ingredients and ${summary.components} components from ${datasetDir}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
