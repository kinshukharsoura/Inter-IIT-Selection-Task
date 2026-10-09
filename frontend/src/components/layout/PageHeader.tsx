import { ArrowLeft } from 'lucide-react';
import { ReactNode, useEffect } from 'react';
import { Link } from 'react-router';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
  meta?: ReactNode;
}

const APP_NAME = 'Recipe Composer';

export function PageHeader({ title, description, actions, back, meta }: PageHeaderProps) {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`;
  }, [title]);

  return (
    <div className="mb-6">
      {back && (
        <Link
          to={back.to}
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-stone-500 hover:text-stone-800"
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">{title}</h1>
          {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
          {description && <p className="mt-2 max-w-2xl text-stone-600">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
