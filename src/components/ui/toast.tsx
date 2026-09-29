"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

// ----------------------------------------------------------------------
// The first shared UI primitive of the MUI -> Tailwind/daisyUI migration.
// Replaces MUI's `Snackbar` for one-off save/copy confirmations. Renders a
// fixed daisyUI `toast` stack of `alert alert-{variant}` items, each
// auto-dismissing on its own timer. Later tasks (alert settings,
// transactions, admin) import `useToast` from this exact file — keep the
// exported names/signature stable.
// ----------------------------------------------------------------------

type ToastVariant = "success" | "error";

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  show: (message: string, variant?: ToastVariant) => void;
};

const AUTO_DISMISS_MS = 4000;

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast toast-end toast-bottom z-50">
        {toasts.map((toast) => (
          <div key={toast.id} role="alert" className={`alert alert-${toast.variant}`}>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
