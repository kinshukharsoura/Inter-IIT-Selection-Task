import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { errorMessage } from '../api/client';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingState } from '../components/ui/Spinner';
import { ErrorState } from '../components/ui/States';
import { useCreateRecipe, useRecipe, useUpdateRecipe } from '../features/recipes/queries';
import { draftFromRecipe, emptyDraft } from '../features/recipes/recipeDraft';
import { RecipeForm } from '../features/recipes/RecipeForm';

export function RecipeCreatePage() {
  const navigate = useNavigate();
  const create = useCreateRecipe();

  return (
    <>
      <PageHeader
        title="New recipe"
        back={{ to: '/recipes', label: 'All recipes' }}
        description="Add raw ingredients and reuse recipes you have already created."
      />
      <RecipeForm
        initialDraft={emptyDraft()}
        submitLabel="Create recipe"
        cancelTo="/recipes"
        onSubmit={async (input) => {
          const recipe = await create.mutateAsync(input);
          toast.success(`"${recipe.name}" created`);
          navigate(`/recipes/${recipe.id}`);
        }}
      />
    </>
  );
}

export function RecipeEditPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const recipe = useRecipe(id);
  const update = useUpdateRecipe(id);

  if (recipe.isPending) return <LoadingState label="Loading recipe…" />;
  if (recipe.isError)
    return (
      <ErrorState message={errorMessage(recipe.error)} onRetry={() => void recipe.refetch()} />
    );

  return (
    <>
      <PageHeader
        title={`Edit ${recipe.data.name}`}
        back={{ to: `/recipes/${id}`, label: 'Back to recipe' }}
      />
      <RecipeForm
        key={recipe.data.id}
        initialDraft={draftFromRecipe(recipe.data)}
        recipeId={id}
        submitLabel="Save changes"
        cancelTo={`/recipes/${id}`}
        onSubmit={async (input) => {
          const saved = await update.mutateAsync(input);
          toast.success(`"${saved.name}" saved`);
          navigate(`/recipes/${id}`);
        }}
      />
    </>
  );
}
