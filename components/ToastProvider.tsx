import React, { createContext, useContext, useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  description?: string;
  action?: ToastAction;
}

interface ToastContextValue {
  addToast: (toast: {
    type: ToastType;
    message?: string;
    title?: string;
    description?: string;
    durationMs?: number;
    action?: ToastAction;
  }) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(({ type, message, title, description, durationMs, action }) => {
    const id = `${Date.now()}_${Math.random()}`;
    const resolvedDuration = durationMs ?? (type === 'error' ? 6000 : 4000);
    const resolvedTitle = title || (type === 'success' ? 'Success' : type === 'warning' ? 'Warning' : type === 'info' ? 'Info' : 'Error');
    const resolvedDescription = description || message || '';
    setToasts((prev) => [...prev, { id, type, title: resolvedTitle, description: resolvedDescription, action }]);
    setTimeout(() => removeToast(id), resolvedDuration);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] space-y-3 max-w-md w-[90vw] sm:w-96">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-xl shadow-lg border text-sm flex items-start gap-3 backdrop-blur bg-white/90 dark:bg-slate-900/90 ${
              toast.type === 'success'
                ? 'border-emerald-200 text-emerald-700'
                : toast.type === 'warning'
                  ? 'border-amber-200 text-amber-700'
                  : toast.type === 'info'
                    ? 'border-sky-200 text-sky-700'
                    : 'border-rose-200 text-rose-700'
            }`}
          >
            <span className="text-lg leading-none">
              {toast.type === 'success' ? '✅' : toast.type === 'warning' ? '⚠️' : toast.type === 'info' ? 'ℹ️' : '❌'}
            </span>
            <div className="flex-1 space-y-1">
              {toast.title && <div className="font-semibold text-sm">{toast.title}</div>}
              {toast.description && <div className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line">{toast.description}</div>}
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    removeToast(toast.id);
                  }}
                  className="text-xs font-semibold underline"
                >
                  {toast.action.label}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};
