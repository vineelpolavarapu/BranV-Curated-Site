'use client';

import { useEffect, useState } from 'react';
import { categoryHrefL1, categoryHrefL2 } from '@/lib/category-href';
import { useRouter } from 'next/navigation';

interface SubcategoryChipsProps {
  categorySlug: string;
  children: Array<{ slug: string; name: string }>;
}

export function SubcategoryChips({ categorySlug, children }: SubcategoryChipsProps) {
  const [activeHash, setActiveHash] = useState('');
  const router = useRouter();

  useEffect(() => {
    setActiveHash(window.location.hash);
    const handleHashChange = () => {
      setActiveHash(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  function handleSelect(selectedValue: string) {
    if (!selectedValue) {
      router.push(categoryHrefL1(categorySlug));
      window.location.hash = '';
      window.dispatchEvent(new Event('hashchange'));
      return;
    }
    const href = categoryHrefL2(categorySlug, selectedValue);
    router.push(href);
    window.location.hash = `#${selectedValue}`;
    window.dispatchEvent(new Event('hashchange'));
  }

  const currentSelectedValue = activeHash.replace(/^#/, '');

  return (
    <div className="mt-4 inline-flex items-center gap-2">
      <label htmlFor="subcategory-select" className="text-xs font-medium text-slate-500">
        Subcategory:
      </label>
      <div className="relative">
        <select
          id="subcategory-select"
          value={currentSelectedValue}
          onChange={(e) => handleSelect(e.target.value)}
          className="appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3.5 pr-8 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
        >
          <option value="">Browse Collections</option>
          {children.map((c) => {
            const subSuffix = c.slug.startsWith(`${categorySlug}-`)
              ? c.slug.substring(categorySlug.length + 1)
              : c.slug;
            return (
              <option key={c.slug} value={subSuffix}>
                {c.name}
              </option>
            );
          })}
        </select>
        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    </div>
  );
}
