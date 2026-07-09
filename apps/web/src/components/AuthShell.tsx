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
    <main className="flex min-h-[100dvh] items-center justify-center bg-neutral-50 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-block text-2xl font-semibold tracking-tight"
          >
            BranV
          </Link>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <h1 className="mb-1 text-2xl font-semibold tracking-tight text-neutral-900">
            {title}
          </h1>
          {subtitle && (
            <p className="mb-6 text-sm text-neutral-600">{subtitle}</p>
          )}
          {children}
        </div>
        {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
      </div>
    </main>
  );
}

export const inputClass =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-[16px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900';

export const labelClass =
  'mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-700';

export const primaryButtonClass =
  'w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50';
