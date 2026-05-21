import Link from 'next/link';
import type { ReactNode } from 'react';
import { SearchBox } from './SearchBox';
import { MobileBottomNav } from './MobileBottomNav';
import { ClickReturnProvider } from './click-return/ClickReturnProvider';
import { WishlistProvider } from './wishlist/WishlistProvider';
import { NewsletterSignup } from './newsletter/NewsletterSignup';
import { AccountPopup } from './AccountPopup';

const SHOP_CATEGORIES = [
  { name: 'Clothing', slug: 'clothing' },
  { name: 'Suits & Formal', slug: 'suits-and-formal' },
  { name: 'Footwear', slug: 'footwear' },
  { name: 'Watches', slug: 'watches' },
  { name: 'Accessories', slug: 'accessories' },
];

export function StorefrontShell({
  children,
  heroOverlay = false,
}: {
  children: ReactNode;
  heroOverlay?: boolean;
}) {
  return (
    <WishlistProvider>
      <ClickReturnProvider>
        <div className="min-h-screen pb-16 md:pb-0">
          <SiteHeader overlay={heroOverlay} />
          {children}
          <SiteFooter />
          <MobileBottomNav />
        </div>
      </ClickReturnProvider>
    </WishlistProvider>
  );
}

function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const headerClasses = overlay
    ? 'absolute inset-x-0 top-0 z-30 text-white'
    : 'sticky top-0 z-30 border-b border-neutral-200 bg-white/95 text-neutral-700 backdrop-blur';
  const linkHoverClass = overlay ? 'hover:text-white/70' : 'hover:text-neutral-950';
  return (
    <header className={headerClasses}>
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-4 pr-14 md:px-6 md:pr-16">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          BranV
        </Link>
        {overlay && (
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <ShopMegaMenu overlay={overlay} />
            <Link href="/new" className={linkHoverClass}>New</Link>
            <Link href="/brands" className={linkHoverClass}>Brands</Link>
            <Link href="/articles" className={linkHoverClass}>Articles</Link>
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2">
          <SearchBox overlay={overlay} />
        </div>
      </div>
      <div className="absolute right-3 top-1/2 hidden -translate-y-1/2 md:block">
        <AccountPopup overlay={overlay} />
      </div>
    </header>
  );
}

function ShopMegaMenu({ overlay = false }: { overlay?: boolean }) {
  const hoverClass = overlay ? 'hover:text-white/70' : 'hover:text-neutral-950';
  const panelClasses = overlay
    ? 'w-max rounded-xl border border-white/40 bg-transparent p-2'
    : 'w-max rounded-xl border border-neutral-200 bg-white p-2 shadow-xl';
  const itemClasses = overlay
    ? 'block whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-white hover:bg-white/10'
    : 'block whitespace-nowrap rounded-md px-3 py-1.5 text-sm hover:bg-neutral-100';
  return (
    <div className="group relative">
      <button className={`flex items-center gap-1 ${hoverClass}`}>
        Shop
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path
            d="M1 3 L5 7 L9 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </button>
      <div className="invisible absolute left-0 top-full pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
        <div className={panelClasses}>
          <ul className="space-y-1">
            {SHOP_CATEGORIES.map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`} className={itemClasses}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-7xl gap-10 px-6 py-10 text-sm text-neutral-600 md:grid md:grid-cols-[1.5fr_1fr]">
        <div>
          <p className="mb-3 font-medium text-neutral-900">BranV</p>
          <p className="max-w-2xl text-xs leading-relaxed">
            BranV is a curated affiliate platform. We never hold inventory, never
            process payments, never fulfill orders. When you click Buy Now, you
            are redirected to the retailer&apos;s site to complete your purchase.{' '}
            <strong>We earn a small commission on qualifying sales — at no extra cost to you.</strong>
          </p>
          <p className="mt-6 text-xs text-neutral-400">
            © {new Date().getFullYear()} BranV. All rights reserved.
          </p>
        </div>
        <div className="mt-8 md:mt-0">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-700">
            Newsletter
          </p>
          <p className="mb-3 text-xs text-neutral-600">
            Weekly digest of new arrivals and articles.
          </p>
          <NewsletterSignup source="footer" />
        </div>
      </div>
    </footer>
  );
}
