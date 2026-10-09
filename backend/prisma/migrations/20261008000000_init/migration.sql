-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "default_unit" TEXT,
    "external_id" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "servings" INTEGER NOT NULL,
    "external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_components" (
    "id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "ingredient_id" UUID,
    "child_recipe_id" UUID,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_components_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_external_id_key" ON "ingredients"("external_id");

-- CreateIndex
CREATE INDEX "ingredients_created_by_id_idx" ON "ingredients"("created_by_id");

-- CreateIndex
CREATE INDEX "recipes_user_id_updated_at_idx" ON "recipes"("user_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_user_id_external_id_key" ON "recipes"("user_id", "external_id");

-- CreateIndex
CREATE INDEX "recipe_components_recipe_id_position_idx" ON "recipe_components"("recipe_id", "position");

-- CreateIndex
CREATE INDEX "recipe_components_ingredient_id_idx" ON "recipe_components"("ingredient_id");

-- CreateIndex
CREATE INDEX "recipe_components_child_recipe_id_idx" ON "recipe_components"("child_recipe_id");

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_child_recipe_id_fkey" FOREIGN KEY ("child_recipe_id") REFERENCES "recipes"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written integrity constraints (not expressible in schema.prisma)
-- ---------------------------------------------------------------------------

-- A component references exactly one target: an ingredient XOR a recipe.
ALTER TABLE "recipe_components"
  ADD CONSTRAINT "recipe_components_exactly_one_target"
  CHECK (num_nonnulls("ingredient_id", "child_recipe_id") = 1);

-- A recipe can never directly contain itself (deeper cycles are rejected by the service layer).
ALTER TABLE "recipe_components"
  ADD CONSTRAINT "recipe_components_no_self_reference"
  CHECK ("child_recipe_id" IS NULL OR "child_recipe_id" <> "recipe_id");

ALTER TABLE "recipe_components"
  ADD CONSTRAINT "recipe_components_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "recipe_components"
  ADD CONSTRAINT "recipe_components_position_non_negative" CHECK ("position" >= 0);

-- Recipe lines are measured in batches or servings of the referenced recipe.
ALTER TABLE "recipe_components"
  ADD CONSTRAINT "recipe_components_recipe_unit"
  CHECK ("child_recipe_id" IS NULL OR "unit" IN ('batch', 'serving'));

ALTER TABLE "recipes"
  ADD CONSTRAINT "recipes_servings_positive" CHECK ("servings" > 0);

ALTER TABLE "recipes"
  ADD CONSTRAINT "recipes_name_not_blank" CHECK (length(btrim("name")) > 0);

ALTER TABLE "ingredients"
  ADD CONSTRAINT "ingredients_name_not_blank" CHECK (length(btrim("name")) > 0);

-- Case-insensitive uniqueness: one "Tomato Sauce" per user, one "Tomato" globally.
CREATE UNIQUE INDEX "recipes_user_id_name_lower_key" ON "recipes" ("user_id", lower("name"));
CREATE UNIQUE INDEX "ingredients_name_lower_key" ON "ingredients" (lower("name"));
