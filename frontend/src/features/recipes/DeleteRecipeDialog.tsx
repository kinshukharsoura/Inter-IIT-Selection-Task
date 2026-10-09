import { toast } from 'sonner';
import { errorMessage } from '../../api/client';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useDeleteRecipe } from './queries';

interface DeleteRecipeDialogProps {
  recipe: { id: string; name: string } | null;
  onClose: () => void;
  onDeleted?: () => void;
}

/** Confirmation + deletion. A recipe used by others is rejected by the API (409) and explained in a toast. */
export function DeleteRecipeDialog({ recipe, onClose, onDeleted }: DeleteRecipeDialogProps) {
  const remove = useDeleteRecipe();

  const confirm = async () => {
    if (!recipe) return;
    try {
      await remove.mutateAsync(recipe.id);
      toast.success(`"${recipe.name}" deleted`);
      onClose();
      onDeleted?.();
    } catch (err) {
      toast.error(errorMessage(err), { duration: 8000 });
      onClose();
    }
  };

  return (
    <ConfirmDialog
      open={recipe !== null}
      title={`Delete "${recipe?.name ?? ''}"?`}
      description="This permanently deletes the recipe and its component list. Recipes that use it must be updated first."
      confirmLabel="Delete recipe"
      destructive
      loading={remove.isPending}
      onConfirm={() => void confirm()}
      onCancel={onClose}
    />
  );
}
