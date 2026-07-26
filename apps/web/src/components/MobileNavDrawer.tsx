'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SHOP_CATEGORIES } from '@/lib/shop-categories';
import { categoryHrefL2 } from '@/lib/category-href';
import { Icon } from './icons';

export function MobileNavDrawer({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  function toggleL1(slug: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  const triggerColor = overlay ? 'text-primary-fg' : 'text-content';

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={`md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md ${triggerColor}`}
      >
        <Icon.Menu size={22} strokeWidth={1.75} aria-hidden />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-content/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[82vw] max-w-sm md:max-w-md flex-col bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="bv-nav-logo inline-flex items-center gap-0 text-l font-semibold tracking-tight leading-none"
              >
                <img
                  src="/hero/logo.png"
                  
                  className="h-10 w-10 object-contain translate-y-1"
                />
                <span>BranV</span>
              </Link>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-content-soft hover:bg-surface-muted"
              >
                <Icon.Close size={18} strokeWidth={1.75} aria-hidden />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-3 text-sm">
              <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-content-soft">
                Shop
              </p>
              <ul className="space-y-0.5">
                {SHOP_CATEGORIES.map((c) => {
                  const isOpen = expanded.has(c.slug);
                  const hasSubs = c.subcategories.length > 0;
                  return (
                    <li key={c.slug}>
                      <div className="flex items-stretch">
                        <Link
                          href={`/category/${c.slug}`}
                          onClick={() => setOpen(false)}
                          className="flex-1 rounded-md px-3 py-2.5 font-medium text-content hover:bg-surface-muted"
                        >
                          {c.name}
                        </Link>
                        {hasSubs && (
                          <button
                            type="button"
                            aria-label={isOpen ? `Collapse ${c.name}` : `Expand ${c.name}`}
                            aria-expanded={isOpen}
                            onClick={() => toggleL1(c.slug)}
                            className="ml-1 inline-flex h-10 w-10 items-center justify-center rounded-md text-content-soft hover:bg-surface-muted"
                          >
                            <Icon.ChevronDown
                              size={12}
                              strokeWidth={1.75}
                              aria-hidden
                              className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            />
                          </button>
                        )}
                      </div>
                      {hasSubs && isOpen && (
                        <ul className="mb-1 ml-3 mt-0.5 space-y-0.5 border-l border-line pl-2">
                          {c.subcategories.map((sub) => (
                            <li key={sub.slug}>
                              <Link
                                href={categoryHrefL2(c.slug, sub.slug)}
                                onClick={() => setOpen(false)}
                                className="block rounded-md px-3 py-2 text-content-soft hover:bg-surface-muted"
                              >
                                {sub.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>
        </div>,
        document.body
      )}
    </>
  );
}
