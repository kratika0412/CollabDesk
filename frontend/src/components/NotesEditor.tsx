import type { TextareaHTMLAttributes } from 'react';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function NotesEditor({ className = '', ...props }: Props) {
  return (
    <textarea
      className={`h-full w-full resize-none rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-sm text-slate-50 shadow-inner shadow-black/40 outline-none placeholder:text-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 ${className}`}
      {...props}
    />
  );
}

