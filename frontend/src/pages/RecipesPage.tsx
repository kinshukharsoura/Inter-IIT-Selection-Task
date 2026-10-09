import {
  BookOpen,
  Calendar,
  ChefHat,
  Eye,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { errorMessage } from '../api/client';
import type { RecipeFilters } from '../api/endpoints';
import type { RecipeSummary } from '../api/types';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Button, ButtonLink } from '../components/ui/Button';
import { Field, Input, Select } from '../components/ui/FormControls';
import { LoadingState } from '../components/ui/Spinner';
import { EmptyState, ErrorState } from '../components/ui/States';
import { DeleteRecipeDialog } from '../features/recipes/DeleteRecipeDialog';
import { useCategories, useRecipes } from '../features/recipes/queries';
import { formatDate, pluralize } from '../lib/format';
import { useDebouncedValue } from '../lib/useDebouncedValue';

const SORT_OPTIONS: { value: NonNullable<RecipeFilters['sort']>; label: string }[] = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'created', label: 'Recently created' },
  { value: 'name', label: 'Name (A–Z)' },
];

export function RecipesPage() {
  // Filters live in the URL so they survive reloads and back-navigation.
  const [params, setParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(params.get('search') ?? '');
  const search = useDebouncedValue(searchInput.trim());
  const category = params.get('category') ?? '';
  const sort = (params.get('sort') as RecipeFilters['sort']) ?? 'updated';
  const [toDelete, setToDelete] = useState<RecipeSummary | null>(null);

  const recipes = useRecipes({
    search: search || undefined,
    category: category || undefined,
    sort,
  });
  const categories = useCategories();

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const filtering = Boolean(search || category);

  return (
    <>
      <PageHeader
        title="My recipes"
        description="Recipes can contain ingredients and other recipes — reuse a sauce or dough instead of retyping it."
        actions={
          <ButtonLink
            to="/recipes/new"
            variant="primary"
            icon={<Plus aria-hidden="true" className="size-4" />}
          >
            New recipe
          </ButtonLink>
        }
      />

      <div role="search" className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Field label="Search recipes" hideLabel>
          {({ id }) => (
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-3 size-4 text-stone-400"
              />
              <Input
                id={id}
                type="search"
                className="pl-9"
                placeholder="Search by name, category, ingredient or sub-recipe…"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setParam('search', e.target.value.trim());
                }}
              />
            </div>
          )}
        </Field>
        <Field label="Filter by category" hideLabel>
          {({ id }) => (
            <Select id={id} value={category} onChange={(e) => setParam('category', e.target.value)}>
              <option value="">All categories</option>
              {categories.data?.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Sort recipes" hideLabel>
          {({ id }) => (
            <Select id={id} value={sort} onChange={(e) => setParam('sort', e.target.value)}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {recipes.isPending ? (
        <LoadingState label="Loading recipes…" />
      ) : recipes.isError ? (
        <ErrorState message={errorMessage(recipes.error)} onRetry={() => void recipes.refetch()} />
      ) : recipes.data.length === 0 ? (
        filtering ? (
          <EmptyState
            icon={<Search className="size-10" />}
            title="No matching recipes"
            description="Try a different search term or category."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearchInput('');
                  setParams({}, { replace: true });
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<BookOpen className="size-10" />}
            title="No recipes yet"
            description="Create your first recipe. Start with a reusable base, like a tomato sauce or a pizza dough."
            action={
              <ButtonLink
                to="/recipes/new"
                variant="primary"
                icon={<Plus aria-hidden="true" className="size-4" />}
              >
                Create a recipe
              </ButtonLink>
            }
          />
        )
      ) : (
        <>
          <p className="mb-3 text-sm text-stone-500" aria-live="polite">
            {pluralize(recipes.data.length, 'recipe')}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.data.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} onDelete={() => setToDelete(recipe)} />
            ))}
          </ul>
        </>
      )}

      <DeleteRecipeDialog recipe={toDelete} onClose={() => setToDelete(null)} />
    </>
  );
}

function RecipeCard({ recipe, onDelete }: { recipe: RecipeSummary; onDelete: () => void }) {
  return (
    <li className="flex flex-col rounded-xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="flex-1 p-5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-stone-900">
            <Link to={`/recipes/${recipe.id}`} className="hover:text-brand-700">
              {recipe.name}
            </Link>
          </h2>
          {recipe.category && <Badge>{recipe.category}</Badge>}
        </div>
        {recipe.description && (
          <p className="mb-3 line-clamp-2 text-sm text-stone-600">{recipe.description}</p>
        )}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm text-stone-600">
          <div className="flex items-center gap-1.5">
            <Users aria-hidden="true" className="size-4 text-stone-400" />
            <dt className="sr-only">Servings</dt>
            <dd>{pluralize(recipe.servings, 'serving')}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers aria-hidden="true" className="size-4 text-stone-400" />
            <dt className="sr-only">Components</dt>
            <dd>{pluralize(recipe.componentCount, 'component')}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <ChefHat aria-hidden="true" className="size-4 text-stone-400" />
            <dt className="sr-only">Used in</dt>
            <dd>
              {recipe.usedInCount > 0
                ? `Used in ${pluralize(recipe.usedInCount, 'recipe')}`
                : 'Not reused yet'}
            </dd>
          </div>
          <div
            className="flex items-center gap-1.5"
            title={`Created ${formatDate(recipe.createdAt)}`}
          >
            <Calendar aria-hidden="true" className="size-4 text-stone-400" />
            <dt className="sr-only">Last updated</dt>
            <dd>{formatDate(recipe.updatedAt)}</dd>
          </div>
        </dl>
      </div>
      <div className="flex items-center gap-1 border-t border-stone-100 px-3 py-2">
        <ButtonLink
          to={`/recipes/${recipe.id}`}
          variant="ghost"
          size="sm"
          icon={<Eye aria-hidden="true" className="size-4" />}
        >
          View
        </ButtonLink>
        <ButtonLink
          to={`/recipes/${recipe.id}/edit`}
          variant="ghost"
          size="sm"
          icon={<Pencil aria-hidden="true" className="size-4" />}
        >
          Edit
        </ButtonLink>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-red-600 hover:bg-red-50"
          onClick={onDelete}
          icon={<Trash2 aria-hidden="true" className="size-4" />}
          aria-label={`Delete ${recipe.name}`}
        >
          Delete
        </Button>
      </div>
    </li>
  );
}
