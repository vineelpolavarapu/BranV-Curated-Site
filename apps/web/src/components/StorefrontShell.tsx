import Link from 'next/link';
import type { ReactNode } from 'react';
import { SearchBox } from './SearchBox';
import { MobileBottomNav } from './MobileBottomNav';
import { ClickReturnProvider } from './click-return/ClickReturnProvider';
import { WishlistProvider } from './wishlist/WishlistProvider';
import { NewsletterSignup } from './newsletter/NewsletterSignup';
import { AccountPopup } from './AccountPopup';
import { AnimateOnScroll } from './AnimateOnScroll';

type SubCategory = { name: string; slug: string };
type ShopCategory = { name: string; slug: string; subcategories: SubCategory[] };

const SHOP_CATEGORIES: ShopCategory[] = [
  {
    name: 'Shirts',
    slug: 'shirts',
    subcategories: [
      { name: 'Half Sleeves', slug: 'shirts-half-sleeves' },
      { name: 'Full Sleeves', slug: 'shirts-full-sleeves' },
      { name: 'Checks', slug: 'shirts-checks' },
      { name: 'Printed', slug: 'shirts-printed' },
      { name: 'Formals', slug: 'shirts-formals' },
    ],
  },
  {
    name: 'T-Shirts',
    slug: 't-shirts',
    subcategories: [
      { name: 'Polo T-Shirts', slug: 't-shirts-polo-t-shirts' },
      { name: 'Full Neck T-Shirts', slug: 't-shirts-full-neck-t-shirts' },
      { name: 'Collar T-Shirts', slug: 't-shirts-collar-t-shirts' },
    ],
  },
  {
    name: 'Jeans',
    slug: 'jeans',
    subcategories: [
      { name: 'Baggy Jeans', slug: 'jeans-baggy-jeans' },
      { name: 'Formal Jeans', slug: 'jeans-formal-jeans' },
      { name: 'Cotton Jeans', slug: 'jeans-cotton-jeans' },
      { name: 'Slim Fit', slug: 'jeans-slim-fit' },
    ],
  },
  {
    name: 'Footwear',
    slug: 'footwear',
    subcategories: [
      { name: 'Sneakers', slug: 'footwear-sneakers' },
      { name: 'Loafers', slug: 'footwear-loafers' },
      { name: 'Formal Shoes', slug: 'footwear-formal-shoes' },
      { name: 'Boots', slug: 'footwear-boots' },
      { name: 'Sandals & Slippers', slug: 'footwear-sandals-and-slippers' },
      { name: 'Sports Shoes', slug: 'footwear-sports-shoes' },
      { name: 'Chappals', slug: 'footwear-chappals' },
    ],
  },
  {
    name: 'Tracks',
    slug: 'tracks',
    subcategories: [
      { name: 'Joggers', slug: 'tracks-joggers' },
      { name: 'Slim Fit Tracks', slug: 'tracks-slim-fit-tracks' },
      { name: 'Zipper Tracks', slug: 'tracks-zipper-tracks' },
      { name: 'Cotton Tracks', slug: 'tracks-cotton-tracks' },
      { name: 'Sports Tracks', slug: 'tracks-sports-tracks' },
      { name: 'Printed Tracks', slug: 'tracks-printed-tracks' },
      { name: 'Lounge Tracks', slug: 'tracks-lounge-tracks' },
    ],
  },
  {
    name: 'Watches',
    slug: 'watches',
    subcategories: [
      { name: 'Digital', slug: 'watches-digital' },
      { name: 'Analog', slug: 'watches-analog' },
      { name: 'Classical', slug: 'watches-classical' },
      { name: 'Strap Watches', slug: 'watches-strap-watches' },
      { name: 'Chained Watches', slug: 'watches-chained-watches' },
    ],
  },
];

function subHash(l1Slug: string, subSlug: string): string {
  return subSlug.slice(l1Slug.length + 1);
}

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
        <Link href="/" className="bv-nav-logo text-xl font-semibold tracking-tight">
          BranV
        </Link>
        {overlay && (
          <nav className="bv-nav-links hidden items-center gap-6 text-sm font-medium md:flex">
            <ShopMegaMenu overlay={overlay} />
            <Link href="/new" className={`bv-nav-link ${linkHoverClass}`}>New</Link>
            <Link href="/brands" className={`bv-nav-link ${linkHoverClass}`}>Brands</Link>
            <Link href="/articles" className={`bv-nav-link ${linkHoverClass}`}>Articles</Link>
          </nav>
        )}
        <div className="bv-nav-actions ml-auto flex items-center gap-2">
          <SearchBox overlay={overlay} />
        </div>
      </div>
      <div className="bv-nav-actions absolute right-3 top-1/2 hidden -translate-y-1/2 md:block">
        <AccountPopup overlay={overlay} />
      </div>
    </header>
  );
}

function ChevronDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden fill="none">
      <path d="M1 3 L5 7 L9 3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden fill="none">
      <path d="M2 1 L6 4 L2 7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ShopMegaMenu({ overlay = false }: { overlay?: boolean }) {
  const hoverClass = overlay ? 'hover:text-white/70' : 'hover:text-neutral-950';
  const panelClasses = overlay
    ? 'rounded-xl border border-white/20 bg-black/50 p-2 backdrop-blur-md'
    : 'rounded-xl border border-neutral-200 bg-white p-2 shadow-xl';
  const itemClasses = overlay
    ? 'flex w-full items-center justify-between gap-6 whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-white hover:bg-white/10'
    : 'flex w-full items-center justify-between gap-6 whitespace-nowrap rounded-md px-3 py-1.5 text-sm hover:bg-neutral-100';
  const subItemClasses = overlay
    ? 'block whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-white transition-colors duration-150 hover:bg-white/10'
    : 'block whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors duration-150 hover:bg-neutral-100';

  return (
    <div className="group relative">
      <button className={`flex items-center gap-1 ${hoverClass}`}>
        Shop
        <ChevronDown />
      </button>

      {/* L1 dropdown panel — drops down from -6px on reveal */}
      <div className="invisible absolute left-0 top-full -translate-y-1.5 pt-2 opacity-0 transition duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
        <div className={panelClasses}>
          <ul className="space-y-0.5">
            {SHOP_CATEGORIES.map((c) => (
              <li key={c.slug} className="bv-dropdown-item group/cat relative">
                <Link href={`/category/${c.slug}`} className={`${itemClasses} transition-colors duration-150`}>
                  <span>{c.name}</span>
                  <span className="opacity-40">
                    <ChevronRight />
                  </span>
                </Link>

                {/* L2 flyout — slides in from left by 6px, fixed w-48 for consistency */}
                <div className="invisible absolute left-full top-0 -translate-x-1.5 pl-1.5 opacity-0 transition duration-150 group-hover/cat:visible group-hover/cat:translate-x-0 group-hover/cat:opacity-100">
                  <div className={`${panelClasses} w-48`}>
                    <ul className="space-y-0.5">
                      {/* "All [Category]" always first */}
                      <li className="bv-flyout-item">
                        <Link href={`/category/${c.slug}`} className={subItemClasses}>
                          All {c.name}
                        </Link>
                      </li>
                      {c.subcategories.map((sub) => (
                        <li key={sub.slug} className="bv-flyout-item">
                          <Link href={`/category/${c.slug}#${subHash(c.slug, sub.slug)}`} className={subItemClasses}>
                            {sub.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
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
    <AnimateOnScroll>
      <footer className="mt-20 border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-7xl gap-10 px-6 py-10 text-sm text-neutral-600 md:grid md:grid-cols-[1.5fr_1fr]">
          <div className="bv-enter">
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
          <div className="bv-enter bv-delay-2 mt-8 md:mt-0">
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
    </AnimateOnScroll>
  );
}
