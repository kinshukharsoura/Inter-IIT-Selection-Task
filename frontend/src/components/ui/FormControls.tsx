import {
  forwardRef,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useId,
} from 'react';
import { cn } from '../../lib/cn';

const controlBase =
  'block w-full rounded-lg border bg-white px-3 text-sm text-stone-900 shadow-sm placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-stone-100';

const controlState = (invalid: boolean) => (invalid ? 'border-red-400' : 'border-stone-300');

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  /** Visually hide the label (it is still read by screen readers). */
  hideLabel?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/** Label + control + hint/error wiring with proper ARIA attributes. */
export function Field({ label, error, hint, hideLabel, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={cn('mb-1 block text-sm font-medium text-stone-700', hideLabel && 'sr-only')}
      >
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-stone-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(controlBase, controlState(invalid), 'h-10', className)}
      {...rest}
    />
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export function Textarea({ invalid = false, className, ...rest }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(controlBase, controlState(invalid), 'py-2', className)}
      {...rest}
    />
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };

export function Select({ invalid = false, className, children, ...rest }: SelectProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(controlBase, controlState(invalid), 'h-10 pr-8', className)}
      {...rest}
    >
      {children}
    </select>
  );
}
