import type { ReactNode } from 'react';

export type Toast = {
  id: string;
  message: ReactNode;
  variant?: 'default' | 'success' | 'error';
};

type ToastContainerProps = {
  toasts: Toast[];
  onDismiss: (id: string) => void;
};

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-end px-4 sm:top-4 sm:px-6">
      <div className="flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto transform rounded-xl px-3 py-2 text-xs text-slate-50 shadow-lg shadow-black/40 transition-opacity duration-200 ${
              toast.variant === 'success'
                ? 'border border-emerald-600/60 bg-emerald-950/90'
                : toast.variant === 'error'
                  ? 'border border-red-500/50 bg-red-950/90'
                  : 'border border-slate-700 bg-slate-900/95'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>{toast.message}</div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="ml-1 rounded-full p-0.5 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

