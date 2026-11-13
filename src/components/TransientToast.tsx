import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export interface ToastMessage {
  type: 'success' | 'error';
  text: string;
}

interface TransientToastProps {
  notification: ToastMessage | null;
  onDismiss: () => void;
  durationMs?: number;
  actions?: React.ReactNode;
}

export const TransientToast: React.FC<TransientToastProps> = ({
  notification,
  onDismiss,
  durationMs = 4500,
  actions,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const priorFocusRef = useRef<HTMLElement | null>(null);
  const onDismissRef = useRef(onDismiss);
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocusInside, setHasFocusInside] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [openModalEl, setOpenModalEl] = useState<Element | null>(null);

  const supportsPopover =
    typeof HTMLElement !== 'undefined' &&
    Object.hasOwn(HTMLElement.prototype, 'popover');

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  // Track whether a native modal <dialog open> is currently active
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const checkModal = () => {
      setOpenModalEl(document.querySelector('dialog[open]'));
    };
    checkModal();

    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    });
    return () => observer.disconnect();
  }, [notification]);

  // Configure popover="manual" via setAttribute (safe for native + polyfilled runtimes)
  useEffect(() => {
    const el = popoverRef.current;
    if (!el || !supportsPopover) return;
    el.setAttribute('popover', 'manual');
  }, [supportsPopover]);

  // Show/hide top-layer popover and announce to assistive technologies
  useEffect(() => {
    const el = popoverRef.current;

    if (!notification) {
      setIsHovered(false);
      setHasFocusInside(false);
      setLiveAnnouncement('');
      if (el && supportsPopover) {
        try {
          if (el.matches(':popover-open')) {
            el.hidePopover();
          }
        } catch {
          // ignore
        }
      }
      return;
    }

    if (typeof document !== 'undefined') {
      const active = document.activeElement;
      if (active instanceof HTMLElement && (!el || !el.contains(active))) {
        priorFocusRef.current = active;
      }

      const announcementText = actions
        ? `${notification.text}. Actions available.`
        : notification.text;

      const docAny = document as unknown as {
        ariaNotify?: (msg: string) => void;
      };
      if (typeof docAny.ariaNotify === 'function') {
        docAny.ariaNotify(announcementText);
      } else {
        setLiveAnnouncement(announcementText);
      }
    }

    if (el && supportsPopover) {
      try {
        if (openModalEl) {
          if (el.matches(':popover-open')) {
            el.hidePopover();
          }
        } else if (!el.matches(':popover-open')) {
          el.showPopover();
        }
      } catch {
        // ignore
      }
    }
  }, [notification, actions, supportsPopover, openModalEl]);

  // Auto-dismiss after durationMs, pausing while hovered or keyboard-focused inside the toast
  useEffect(() => {
    if (!notification || isHovered || hasFocusInside) return;
    const effectiveDuration = actions ? Math.max(durationMs, 6000) : durationMs;
    const timer = setTimeout(() => {
      onDismissRef.current();
    }, effectiveDuration);
    return () => clearTimeout(timer);
  }, [notification, isHovered, hasFocusInside, durationMs, actions]);

  const handleManualClose = () => {
    const shouldRestoreFocus = hasFocusInside;
    onDismissRef.current();
    if (shouldRestoreFocus && priorFocusRef.current?.isConnected) {
      priorFocusRef.current.focus();
    }
  };

  const handleBlurCapture = (e: React.FocusEvent<HTMLDivElement>) => {
    const nextFocused = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(nextFocused)) {
      setHasFocusInside(false);
    }
  };

  const isSuccess = notification?.type === 'success';
  const cardClasses = `rounded-md border px-4 py-3 text-sm font-medium shadow-lg flex items-start justify-between gap-3 ${
    isSuccess
      ? 'bg-brand-50 border-brand-200 text-brand-900'
      : 'bg-accent-50 border-accent-100 text-accent-700'
  }`;

  return (
    <>
      {/* Persistent accessible toast landmark & pre-populated live-region fallback */}
      <div role="region" aria-label="Notifications">
        {liveAnnouncement && (
          <p className="visually-hidden">Screen reader announcements</p>
        )}
        <div aria-live="polite" className="visually-hidden">
          {liveAnnouncement}
        </div>

        <div
          ref={popoverRef}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onFocusCapture={() => setHasFocusInside(true)}
          onBlurCapture={handleBlurCapture}
          className={`app-toast ${
            !supportsPopover
              ? notification && !openModalEl
                ? 'app-toast-fallback-open'
                : 'hidden'
              : ''
          }`}
        >
          {notification && !openModalEl && (
            <div className={cardClasses}>
              <div className="flex items-start gap-2.5 min-w-0">
                {isSuccess ? (
                  <CheckCircle2 className="w-4 h-4 text-brand-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-accent-600 shrink-0 mt-0.5" />
                )}
                <span className="break-words">{notification.text}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {actions}
                <button
                  type="button"
                  onClick={handleManualClose}
                  aria-label="Close notification"
                  className="rounded p-1 hover:bg-black/5 text-current"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* When a modal dialog is open, surface modal validation feedback inline inside the active modal instead of behind an inert backdrop */}
      {notification &&
        openModalEl &&
        createPortal(
          <div
            role="alert"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="mx-5 mt-4"
          >
            <div className={cardClasses}>
              <div className="flex items-start gap-2.5 min-w-0">
                {isSuccess ? (
                  <CheckCircle2 className="w-4 h-4 text-brand-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-accent-600 shrink-0 mt-0.5" />
                )}
                <span className="break-words">{notification.text}</span>
              </div>
              <button
                type="button"
                onClick={handleManualClose}
                aria-label="Close notification"
                className="rounded p-1 hover:bg-black/5 text-current shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>,
          openModalEl
        )}
    </>
  );
};
