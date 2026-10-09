# Final Verification Report

Date: 2026-10-08 · Environment: Linux (WSL2), Node.js 24.12, PostgreSQL 16 (local instance).

## 1. Requirements checklist (task PDF)

| # | Requirement (PDF section) | Status | Where |
|---|---|---|---|
| 1 | Recipes made of ingredients **and other recipes** (§1, §2) | ✅ | `recipe_components` with `ingredient_id` XOR `child_recipe_id` |
| 2 | No fixed nesting depth (§2, §5) | ✅ | recursive CTE loader, recursive tree builder, recursive `TreeBranch` UI; tested with 60 levels (unit), 16/25 levels (API), 25 levels (UI) |
| 3 | Provided dataset used (§3) | ✅ | downloaded from the PDF's dataset link → `backend/prisma/data/`, imported by `npm run db:seed` |
| 4 | Recipe Explorer: expand/collapse, ingredient vs recipe, quantities & units, navigate nested recipes, usable when deep (§4) | ✅ | `frontend/src/features/recipes/RecipeTree.tsx` |
| 5 | Recursive structure in data **and** UI (§5) | ✅ | `GET /recipes/:id/tree`, `RecipeTree` |
| 6 | Create / edit / delete recipes (§6) | ✅ | API + Create/Edit pages + delete dialogs |
| 7 | Add / remove ingredients, add / remove recipe components, modify quantities (§6) | ✅ | recipe editor; `POST/PUT/DELETE /recipes/:id/components…` |
| 8 | Serving sizes (§6) and scaling | ✅ | `servings` per recipe, `?servings=N`, `batch`/`serving` component units |
| 9 | Database: users, recipes, ingredients, components, recipe-to-recipe, quantities/units, servings (§7) | ✅ | `schema.prisma` + migration with CHECK constraints; explained in README |
| 10 | Backend APIs with validation (§8) | ✅ | all endpoints listed in §8 plus tree/totals/usages/duplicate/shopping list; Zod |
| 11 | Authentication; users manage their own recipes (§9) | ✅ | bcrypt + JWT, `authenticate` middleware, ownership checks (403) |
| 12 | Complete ingredient expansion (§10) | ✅ | `GET /recipes/:id/ingredients`, "View total ingredients" |
| 13 | Circular dependencies prevented (§12) | ✅ | DFS check + advisory lock + DB self-reference CHECK + safe traversal |
| 14 | `docker compose up` (§13) | ✅ files written · ⚠️ not executed (no Docker here — see "Docker verification" below) | `docker-compose.yml`, Dockerfiles, nginx |
| 15 | `.env.example` (§13) | ✅ | root `.env.example` |
| 16 | Deployment (§14) | ✅ documented · not deployed | README → Deployment |
| 17 | Bonus features (§15) | ✅ selection | search, dependency search, category filter, duplication, shopping list, used-in view, rate limiting, logging, health checks, reverse proxy, CI, tests |
| 18 | README: name & roll no., features, stack, structure, setup, env vars, API docs, DB design, deployment, design decisions, assumptions (§18) | ✅ (roll no. placeholder to be filled) | `README.md` |
| 19 | Architecture diagram (§18, encouraged) | ✅ | `ARCHITECTURE.md` (Mermaid) |

## 2. Commands executed and results

| Step | Command | Result |
|---|---|---|
| Install | `npm install` (backend, frontend) | ✅ |
| Formatting | `npx prettier --check .` (backend, frontend) | ✅ all files formatted |
| Lint | `npx eslint .` (backend, frontend) | ✅ 0 errors, 0 warnings |
| Type check | `tsc --noEmit` (backend), `tsc -p tsconfig.app.json --noEmit` (frontend) | ✅ |
| Migrations | `prisma migrate deploy` / `migrate dev` | ✅ applied; no schema drift |
| Seed | `npm run db:seed` (first run, re-run, `SEED_FORCE=true`) | ✅ 55 recipes, 71 ingredients, 189 components; re-run skips (keeps edits); force re-syncs |
| Backend tests | `npm test` | ✅ **134 / 134** (52 unit + 82 integration on PostgreSQL) |
| Frontend tests | `npm test` | ✅ **20 / 20** |
| Backend build | `npm run build` | ✅ |
| Frontend build | `npm run build` | ✅ (≈ 398 kB JS / 122 kB gzip) |
| API smoke test | health, login, search, tree, totals ×2 servings, cycle, self-reference, delete-in-use, 401, 400 | ✅ all expected responses |
| Browser E2E (headless Chromium, real UI) | login → dashboard → search → detail → expand all → total ingredients → scale servings → open nested recipe → 6-level Grand Feast → create recipe with ingredient + sub-recipe (servings unit) → validation errors → cycle options disabled in editor → delete of referenced recipe blocked (toast) → delete own recipe → shopping list → ingredients → mobile (390 px, no page overflow) → 404 | ✅ no JavaScript errors (only the expected 404/409 network responses) |

## 3. Independent code review and fixes

A separate read-only review pass checked authorization, cycle-detection paths, scaling math,
transactions, frontend flows and Docker config. It found no authorization, cycle or math bugs, and
these issues, all fixed and covered by tests where applicable:

| Finding | Fix |
|---|---|
| Seeding on every container start overwrote user edits and could crash the start-up on a name clash | seed imports the dataset only once (`SEED_FORCE=true` to re-sync); a seed failure no longer blocks the API |
| Login rate limit bypassable via spoofed `X-Forwarded-For` when the API port was published | backend port no longer published; API reached through nginx only |
| Renaming a shared ingredient silently changed other users' recipes | rename refused (409) while other users' recipes use it (+ test) |
| Any failed session check logged the user out | only a 401 logs out; otherwise a retry screen is shown |
| Large edits could hit Prisma's 5 s interactive-transaction timeout (→ 500) | `withUserGraphLock` with explicit `maxWait`/`timeout`; P2028 → 503 |
| Depth cap enforced on read only (a 102-level chain could be saved but never viewed) | depth checked on write (422) (+ unit and integration tests) |
| Servings field could not be cleared; deleted recipe's queries refetched (404 flash); nginx `/assets/` dropped security headers | fixed (+ test for the servings input) |

## 4. Key behaviours verified

- **Recursive expansion**: Grand Feast (6 levels) expands fully in API and UI.
- **Quantity propagation**: A = 2 × B (100 g Flour) → 200 g; A→B→C→D→E multipliers multiply.
- **Serving scaling**: Tomato Sauce (4 servings, 500 g) used as 8 servings → 1000 g; root rescaling
  (Lasagna 6 → 8 servings: Basil 100 g → 133.33 g in the UI).
- **Cycle prevention**: A→A, A→B→A, A→B→C→A, 25-level chain via API; concurrent A→B / B→A → one
  201 and one 409; message `Adding this recipe would create a circular dependency: …`.
- **Authorization**: other users' recipes → 403 on get/tree/totals/update/delete/duplicate/components;
  foreign sub-recipes → 403.
- **Integrity**: deleting a used recipe or ingredient → 409 with details; DB CHECKs reject invalid rows.
- **No N+1**: tree for a 16-level chain loads with exactly 2 queries.

## 5. Docker verification

Docker is **not installed** in the environment where this project was built (and installing it
needs root), so `docker compose up --build` could **not** be executed here. To reduce risk:

- The backend image steps were replayed on a clean copy: `npm ci` → `prisma generate` →
  `npm run build` → `npm prune --omit=dev` → `prisma generate`, then
  `docker-entrypoint.sh` with `NODE_ENV=production`, `RUN_SEED=true` against a **fresh database**:
  migrations applied, compiled seed ran, server started, the exact HEALTHCHECK command passed, and
  login/404/401 responses were correct — with dev dependencies pruned.
- The frontend image build steps (`npm ci`, `npm run build` with `VITE_API_URL=/api`) were replayed
  on a clean copy successfully.
- `docker-compose.yml` and the CI workflow were validated as YAML.
- **Not verified**: the images themselves, nginx config at runtime, inter-container networking.
  Please run `cp .env.example .env && docker compose up --build` to confirm.

## 6. Known limitations

- Docker Compose and the GitHub Actions workflow were not executed (see §5).
- Not deployed; deployment steps are documented only.
- Unit conversion only within mass and within volume (no density-based g↔ml); count units are not converted.
- Recipes are private to their owner; there is no sharing or public catalogue of recipes.
- Expanded trees are capped at depth 100 / 10 000 nodes (totals have no node cap — they are memoised).
- JWT is kept in localStorage (trade-off documented in ARCHITECTURE.md §8); no refresh tokens.
- Native `<select>` pickers are used for ingredients/recipes (accessible and simple, but no fuzzy search inside the picker).
- The README's **Roll No.** is a placeholder that must be filled in by the applicant.

## 7. Assumptions

See README → *Assumptions*. Most important: a dataset recipe component's `quantity` means
"number of batches" of the referenced recipe; component quantities are per batch; ingredients form
a shared catalogue; recipes are private per user; names are unique per user (case-insensitive).
