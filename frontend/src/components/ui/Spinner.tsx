import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

export function Spinner({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dims = { sm: 'size-4', md: 'size-6', lg: 'size-8' }[size];
  return <LoaderCircle aria-hidden="true" className={cn('animate-spin', dims, className)} />;
}

/** Centered loading indicator with an accessible status message. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 py-16 text-stone-500"
    >
      <Spinner size="lg" className="text-brand-600" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function FullPageSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingState label={label} />
    </div>
  );
}
