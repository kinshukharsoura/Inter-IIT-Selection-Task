#!/bin/sh
# Applies pending migrations, optionally seeds demo data, then starts the API.
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "Seeding demo data (skipped if already seeded)..."
  # Seeding is a convenience: never keep the API from starting because of it.
  node dist/prisma/seed.js || echo "WARNING: seeding failed; continuing without demo data" >&2
fi

exec node dist/src/server.js
