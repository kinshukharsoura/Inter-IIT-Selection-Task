import { AlertTriangle } from 'lucide-react';
import { ReactNode } from 'react';
import { Button } from './Button';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
      {icon && <div className="text-stone-400">{icon}</div>}
      <h3 className="text-base font-semibold text-stone-900">{title}</h3>
      {description && <p className="max-w-md text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center"
    >
      <AlertTriangle aria-hidden="true" className="size-8 text-red-500" />
      <p className="text-sm font-medium text-red-800">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
