'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { categoryHrefL2 } from '@/lib/category-href';

interface SubcategoryChipsProps {
  categorySlug: string;
  children: Array<{ slug: string; name: string }>;
}

export function SubcategoryChips({ categorySlug, children }: SubcategoryChipsProps) {
  const [activeHash, setActiveHash] = useState('');

  useEffect(() => {
    setActiveHash(window.location.hash);
    const handleHashChange = () => {
      setActiveHash(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      {children.map((c, i) => {
        // e.g. c.slug is 'shirts-checks', categorySlug is 'shirts', hash is '#checks'
        const subSuffix = c.slug.startsWith(`${categorySlug}-`)
          ? c.slug.substring(categorySlug.length + 1)
          : c.slug;
        const isL2Active = activeHash === `#${subSuffix}`;

        return (
          <li
            key={c.slug}
            style={{ animationDelay: `${(i + 3) * 40}ms` }}
            className={`bv-enter transition-transform duration-250 ease-out-back ${
              isL2Active ? 'scale-[1.04]' : 'scale-100'
            }`}
          >
            <Link
              href={categoryHrefL2(categorySlug, subSuffix)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200 ${
                isL2Active
                  ? 'border-neutral-950 bg-neutral-950 text-white'
                  : 'border-neutral-300 text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {c.name}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
