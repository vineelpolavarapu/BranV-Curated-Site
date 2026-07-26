'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type LucideIcon } from './icons';

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Home', icon: Icon.Home },
  { href: '/shop', label: 'Shop', icon: Icon.Shop },
  { href: '/wishlist', label: 'Wishlist', icon: Icon.Wishlist },
  { href: '/help', label: 'Help', icon: Icon.Help },
  { href: '/account', label: 'Account', icon: Icon.Account },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden shadow-lg"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          const IconCmp = item.icon;
          return (
            <li key={item.href} className="relative">
              {active && (
                <span className="absolute top-0 left-1/2 h-[3px] w-9 -translate-x-1/2 rounded-b-full bg-primary" />
              )}
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-15 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors duration-150 ${
                  active ? 'text-primary font-bold' : 'text-content-soft hover:text-content'
                }`}
              >
                <IconCmp
                  size={20}
                  strokeWidth={active ? 2.25 : 1.75}
                  aria-hidden
                />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
