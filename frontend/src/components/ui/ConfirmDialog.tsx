import { useEffect, useId, useRef } from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal confirmation built on the native <dialog> element, which provides
 * focus trapping, Escape-to-close and an inert background for free.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close?.();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(e) => {
        e.preventDefault();
        if (!loading) onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-stone-200 bg-white p-0 shadow-xl"
    >
      {open && (
        <div className="p-6">
          <h2 id={titleId} className="text-lg font-semibold text-stone-900">
            {title}
          </h2>
          <p id={descriptionId} className="mt-2 text-sm text-stone-600">
            {description}
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={onCancel} disabled={loading} autoFocus>
              Cancel
            </Button>
            <Button
              variant={destructive ? 'danger' : 'primary'}
              onClick={onConfirm}
              loading={loading}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
