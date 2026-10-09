import { ChefHat, Copy, ListChecks, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ApiError, errorMessage } from '../api/client';
import type { RecipeDetail } from '../api/types';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { LoadingState } from '../components/ui/Spinner';
import { EmptyState, ErrorState } from '../components/ui/States';
import { DeleteRecipeDialog } from '../features/recipes/DeleteRecipeDialog';
import { useDuplicateRecipe, useRecipe, useRecipeTree } from '../features/recipes/queries';
import { RecipeTree } from '../features/recipes/RecipeTree';
import { ServingsScaler } from '../features/recipes/ServingsScaler';
import { TotalIngredients } from '../features/recipes/TotalIngredients';
import { formatDate, pluralize } from '../lib/format';

export function RecipeDetailPage() {
  const { id = '' } = useParams();
  const recipe = useRecipe(id);

  if (recipe.isPending) return <LoadingState label="Loading recipe…" />;
  if (recipe.isError) {
    const status = recipe.error instanceof ApiError ? recipe.error.status : 0;
    return (
      <div className="space-y-4">
        <ErrorState
          message={
            status === 404 || status === 400
              ? 'This recipe does not exist.'
              : errorMessage(recipe.error)
          }
          onRetry={status >= 500 || status === 0 ? () => void recipe.refetch() : undefined}
        />
        <div className="text-center">
          <ButtonLink to="/recipes">Back to recipes</ButtonLink>
        </div>
      </div>
    );
  }
  // Remount per recipe so servings/expansion state resets when navigating into a sub-recipe.
  return <RecipeDetailView key={recipe.data.id} recipe={recipe.data} />;
}

function RecipeDetailView({ recipe }: { recipe: RecipeDetail }) {
  const navigate = useNavigate();
  const [servings, setServings] = useState(recipe.servings);
  const [showTotals, setShowTotals] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const duplicate = useDuplicateRecipe();

  // Only pass a target when it differs, so the default view shares its cache entry.
  const target = servings === recipe.servings ? undefined : servings;
  const tree = useRecipeTree(recipe.id, target);

  const handleDuplicate = async () => {
    try {
      const copy = await duplicate.mutateAsync(recipe.id);
      toast.success(`Created "${copy.name}"`);
      navigate(`/recipes/${copy.id}/edit`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title={recipe.name}
        back={{ to: '/recipes', label: 'All recipes' }}
        description={recipe.description}
        meta={
          <>
            {recipe.category && <Badge>{recipe.category}</Badge>}
            <Badge tone="neutral">Makes {pluralize(recipe.servings, 'serving')}</Badge>
            <Badge tone="neutral">{pluralize(recipe.componentCount, 'component')}</Badge>
            <span className="text-xs text-stone-500">Updated {formatDate(recipe.updatedAt)}</span>
          </>
        }
        actions={
          <>
            <ButtonLink
              to={`/recipes/${recipe.id}/edit`}
              icon={<Pencil aria-hidden="true" className="size-4" />}
            >
              Edit
            </ButtonLink>
            <Button
              variant="secondary"
              onClick={() => void handleDuplicate()}
              loading={duplicate.isPending}
              icon={<Copy aria-hidden="true" className="size-4" />}
            >
              Duplicate
            </Button>
            <Button
              variant="danger"
              onClick={() => setConfirmDelete(true)}
              icon={<Trash2 aria-hidden="true" className="size-4" />}
            >
              Delete
            </Button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-5 py-3 shadow-sm">
        <ServingsScaler baseServings={recipe.servings} value={servings} onChange={setServings} />
        <Button
          variant={showTotals ? 'secondary' : 'primary'}
          onClick={() => setShowTotals((v) => !v)}
          aria-expanded={showTotals}
          aria-controls="total-ingredients"
          icon={<ListChecks aria-hidden="true" className="size-4" />}
        >
          {showTotals ? 'Hide total ingredients' : 'View total ingredients'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader
            title="Composition"
            description="Expand nested recipes to see exactly what goes into this dish."
          />
          {tree.isPending ? (
            <LoadingState label="Building recipe tree…" />
          ) : tree.isError ? (
            <CardBody>
              <ErrorState message={errorMessage(tree.error)} onRetry={() => void tree.refetch()} />
            </CardBody>
          ) : tree.data.children.length === 0 ? (
            <CardBody>
              <EmptyState
                icon={<ChefHat className="size-10" />}
                title="This recipe has no components yet"
                action={<ButtonLink to={`/recipes/${recipe.id}/edit`}>Add components</ButtonLink>}
              />
            </CardBody>
          ) : (
            <div className={tree.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
              <RecipeTree root={tree.data} />
            </div>
          )}
        </Card>

        <div className="min-w-0 space-y-6">
          {showTotals && (
            <Card>
              <div id="total-ingredients">
                <CardHeader
                  title="Total ingredients"
                  description={`Every nested recipe expanded, for ${pluralize(servings, 'serving')}.`}
                />
                <CardBody>
                  <TotalIngredients recipeId={recipe.id} servings={target} />
                </CardBody>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Used in"
              description="Recipes that include this one as a component."
            />
            <CardBody>
              {recipe.usedIn.length === 0 ? (
                <p className="text-sm text-stone-500">Not used by any other recipe yet.</p>
              ) : (
                <ul className="space-y-1">
                  {recipe.usedIn.map((parent) => (
                    <li key={parent.id}>
                      <Link
                        to={`/recipes/${parent.id}`}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-800 hover:bg-brand-50 hover:text-brand-800"
                      >
                        <ChefHat aria-hidden="true" className="size-4 text-brand-600" />
                        {parent.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <DeleteRecipeDialog
        recipe={confirmDelete ? recipe : null}
        onClose={() => setConfirmDelete(false)}
        onDeleted={() => navigate('/recipes', { replace: true })}
      />
    </>
  );
}
