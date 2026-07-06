'use client';

import Link from 'next/link';
import { ReactNode, useEffect, useState } from 'react';
import { SearchBox } from './SearchBox';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileNavDrawer } from './MobileNavDrawer';
import { ClickReturnProvider } from './click-return/ClickReturnProvider';
import { WishlistProvider } from './wishlist/WishlistProvider';
import { NewsletterSignup } from './newsletter/NewsletterSignup';
import { AccountPopup } from './AccountPopup';
import { AnimateOnScroll } from './AnimateOnScroll';
import { SHOP_CATEGORIES } from '@/lib/shop-categories';
import { categoryHrefL2 } from '@/lib/category-href';

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
        <div className="min-h-screen pb-16 lg:pb-0">
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
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Keep header visible at the top
      if (currentScrollY <= 80) {
        setVisible(true);
      } else {
        // Hide if scrolling down, show if scrolling up
        if (currentScrollY > lastScrollY) {
          setVisible(false);
        } else {
          setVisible(true);
        }
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const headerBaseClasses = overlay
    ? 'fixed inset-x-0 top-0 z-30 text-white transition-all duration-300 ease-out'
    : 'sticky top-0 z-30 border-b border-neutral-200 bg-white/95 text-neutral-700 backdrop-blur transition-all duration-300 ease-out';

  const visibilityClasses = visible
    ? 'translate-y-0 opacity-100'
    : '-translate-y-full opacity-0 pointer-events-none';

  const linkHoverClass = overlay ? 'hover:text-white/70' : 'hover:text-neutral-950';

  return (
    <header className={`${headerBaseClasses} ${visibilityClasses}`}>
      <div className="flex w-full items-center px-4 py-4 lg:pl-0 lg:pr-6">
        <Link href="/" className="bv-nav-logo inline-flex items-center gap-0 text-l font-semibold tracking-tight leading-none">
          <img src="/hero/logo.png" alt="BranV" className="h-10 w-10 object-contain translate-y-1" />
          <span>BranV</span>
        </Link>
        <nav className="bv-nav-links hidden items-center gap-6 text-sm font-medium lg:flex ml-12">
          <ShopMegaMenu overlay={overlay} />
          <Link href="/new" className={`bv-nav-link ${linkHoverClass}`}>New</Link>
          <Link href="/brands" className={`bv-nav-link ${linkHoverClass}`}>Brands</Link>
          <Link href="/articles" className={`bv-nav-link ${linkHoverClass}`}>Articles</Link>
        </nav>
        <div className="bv-nav-actions ml-auto flex items-center gap-3">
          <SearchBox overlay={overlay} />
          <div className="hidden lg:block">
            <AccountPopup overlay={overlay} />
          </div>
          <MobileNavDrawer overlay={overlay} />
        </div>
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
                          <Link href={categoryHrefL2(c.slug, sub.slug)} className={subItemClasses}>
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
