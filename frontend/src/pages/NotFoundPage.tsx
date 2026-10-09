import { ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/States';

export function NotFoundPage() {
  return (
    <div className="py-12">
      <EmptyState
        title="Page not found"
        description="The page you are looking for does not exist."
        action={<ButtonLink to="/recipes">Go to my recipes</ButtonLink>}
      />
    </div>
  );
}
