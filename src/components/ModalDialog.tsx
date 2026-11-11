import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export const ModalDialog: React.FC<ModalDialogProps> = ({
  open,
  onClose,
  title,
  subtitle,
  maxWidthClass = 'max-w-xl',
  children,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    const handleClose = () => {
      el.returnValue = '';
      onCloseRef.current();
    };

    const handleCancel = (event: Event) => {
      event.preventDefault();
      el.close();
    };

    el.addEventListener('close', handleClose);
    el.addEventListener('cancel', handleCancel);

    // Fallback for browsers / Electron runtimes without declarative <dialog closedby="any">
    let removeBackdropFallback: (() => void) | undefined;
    if (
      typeof HTMLDialogElement !== 'undefined' &&
      !('closedBy' in HTMLDialogElement.prototype)
    ) {
      const handleBackdropClick = (event: MouseEvent) => {
        if (event.target !== el) return;
        const rect = el.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        el.close();
      };
      el.addEventListener('click', handleBackdropClick);
      removeBackdropFallback = () =>
        el.removeEventListener('click', handleBackdropClick);
    }

    return () => {
      el.removeEventListener('close', handleClose);
      el.removeEventListener('cancel', handleCancel);
      removeBackdropFallback?.();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const el = dialogRef.current;
        if (el?.open) {
          event.preventDefault();
          el.close();
        } else {
          onCloseRef.current();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as any)}
      aria-labelledby={titleId}
      className={maxWidthClass}
    >
      {open && (
        <div className="flex flex-col max-h-[86vh]">
          <div className="px-5 py-4 border-b border-line flex items-start justify-between gap-4 bg-paper">
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-ink">
                {title}
              </h2>
              {subtitle && (
                <p className="text-sm text-mut mt-0.5">{subtitle}</p>
              )}
            </div>
            <form method="dialog">
              <button
                type="submit"
                aria-label="Close dialog"
                className="btn-secondary !p-1.5"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          </div>
          <div className="p-5 overflow-y-auto overscroll-contain space-y-4">
            {children}
          </div>
        </div>
      )}
    </dialog>
  );
};
