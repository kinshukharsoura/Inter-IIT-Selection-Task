import { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn('rounded-xl border border-stone-200 bg-white shadow-sm', className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  titleId,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  titleId?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
      <div className="min-w-0">
        <h2 id={titleId} className="text-base font-semibold text-stone-900">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}
