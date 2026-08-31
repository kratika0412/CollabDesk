import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
};

export function Button({ loading, children, className = '', ...props }: Props) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-slate-50 shadow-sm shadow-sky-500/40 transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
      )}
      {children}
    </button>
  );
}

