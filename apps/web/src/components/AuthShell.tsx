import Link from 'next/link';
import type { ReactNode } from 'react';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-canvas px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-flex flex-col items-center user-select-none"
          >
            <div className="font-heading text-3xl font-extrabold tracking-tight text-slate-900">
              Bran<span className="text-primary">V</span>
            </div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
              ALL FOR MEN
            </div>
          </Link>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="mb-1.5 font-heading text-2xl font-extrabold tracking-tight text-slate-900">
            {title}
          </h1>
          {subtitle && (
            <p className="mb-6 text-sm font-medium text-slate-500">{subtitle}</p>
          )}
          {children}
        </div>
        {footer && <div className="mt-6 text-center text-sm font-medium text-slate-600">{footer}</div>}
      </div>
    </main>
  );
}

export const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all';

export const labelClass =
  'mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500';

export const primaryButtonClass =
  'w-full rounded-xl bg-primary px-4 py-3.5 text-sm font-extrabold text-white shadow-md transition-all hover:bg-primary-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50';
