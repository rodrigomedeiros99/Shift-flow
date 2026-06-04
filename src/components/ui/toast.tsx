'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type ToastVariant = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (input: {
    title: string;
    description?: string;
    variant?: ToastVariant;
  }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_ICON = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const;

const VARIANT_ACCENT: Record<ToastVariant, string> = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-info',
};

const AUTO_DISMISS_MS = 4000;

/**
 * Toast notifications (§5 Notification Standards): informative, non-disruptive,
 * auto-dismissing. Mounted once near the app root; consume via {@link useToast}.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue['toast']>(
    ({ title, description, variant = 'success' }) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, title, description, variant }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-full max-w-sm flex-col gap-2"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((item) => {
          const Icon = VARIANT_ICON[item.variant];
          return (
            <div
              key={item.id}
              role="status"
              className="border-border bg-surface-raised pointer-events-auto flex items-start gap-3 rounded-md border p-3 shadow-lg"
            >
              <Icon
                className={cn(
                  'mt-0.5 h-5 w-5 shrink-0',
                  VARIANT_ACCENT[item.variant],
                )}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-sm font-medium">
                  {item.title}
                </p>
                {item.description ? (
                  <p className="text-foreground-muted mt-0.5 text-sm">
                    {item.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="text-foreground-subtle hover:text-foreground rounded p-0.5"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
