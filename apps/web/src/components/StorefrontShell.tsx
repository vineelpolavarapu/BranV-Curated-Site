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
        <div className={`grid grid-rows-[auto_1fr_auto] min-h-[100dvh] pb-16 lg:pb-0 ${heroOverlay ? 'pt-0' : 'pt-28 lg:pt-24'}`}>
          <SiteHeader overlay={heroOverlay} />
          <main className="w-full">{children}</main>
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
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;

        if (currentScrollY <= 40) {
          setVisible(true);
        } else if (currentScrollY > lastScrollY + 5) {
          // Hide navbar when scrolling down
          setVisible(false);
        } else if (currentScrollY < lastScrollY - 5) {
          // Show navbar when scrolling up
          setVisible(true);
        }

        setLastScrollY(currentScrollY);
        ticking = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // 100% Transparent background at all times per Task 1
  const headerBaseClasses =
    'fixed inset-x-0 top-0 z-30 bg-transparent text-slate-900 transition-all duration-300 ease-out pointer-events-auto';

  const visibilityClasses = visible
    ? 'translate-y-0 opacity-100'
    : '-translate-y-full opacity-0 pointer-events-none';

  const linkHoverClass = 'hover:text-primary';

  return (
    <header className={`${headerBaseClasses} ${visibilityClasses}`}>
      {/* Top Header Row */}
      <div className="mx-auto grid grid-cols-[auto_auto] lg:grid-cols-[auto_1fr_auto] items-center justify-between px-4 py-3 lg:py-4 w-full max-w-7xl gap-4">
        {/* Mobile Drawer Trigger (Mobile Only) */}
        <div className="lg:hidden">
          <MobileNavDrawer overlay={overlay} />
        </div>

        {/* Brand Logo */}
        <Link href="/" className="bv-nav-logo inline-flex flex-col items-center user-select-none">
          <div className="font-heading text-2xl font-extrabold tracking-tight leading-none text-content">
            Bran<span className="text-primary">V</span>
          </div>
          <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-content">
            ALL FOR MEN
          </div>
        </Link>

        {/* Desktop Navigation Links (Desktop Only) */}
        <nav className="bv-nav-links hidden items-center gap-7 text-sm font-semibold lg:flex">
          <ShopMegaMenu overlay={overlay} />
          <Link href="/new" className={`bv-nav-link ${linkHoverClass}`}>New Arrivals</Link>
          <Link href="/articles" className={`bv-nav-link ${linkHoverClass}`}>Articles</Link>
        </nav>

        {/* Header Action Buttons (Desktop Search + Badges) */}
        <div className="bv-nav-actions flex items-center gap-3">
          {/* Desktop SearchBox (Desktop Only) */}
          <div className="hidden w-72 xl:w-96 lg:block">
            <SearchBox overlay={overlay} />
          </div>

          {/* Wishlist Icon Button with Badge */}
          <Link
            href="/wishlist"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-content hover:bg-surface-muted transition-colors"
            aria-label="Wishlist"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.78-8.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span className="absolute -top-1 -right-1 grid h-4.5 w-4.5 place-items-center rounded-full bg-accent text-[10px] font-bold text-white shadow-sm">
              3
            </span>
          </Link>

          {/* Account Popup (Desktop) */}
          <div className="hidden lg:block">
            <AccountPopup overlay={overlay} />
          </div>
        </div>
      </div>

      {/* Dedicated Mobile Search Row (Mobile Only — Resolves Logo Collision Bug) */}
      <div className="px-4 pb-3 lg:hidden">
        <SearchBox overlay={overlay} />
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
  const hoverClass = overlay ? 'hover:text-primary-fg/70' : 'hover:text-primary';
  const panelClasses = overlay
    ? 'rounded-xl border border-white/20 bg-content/50 p-2 backdrop-blur-md'
    : 'rounded-xl border border-line bg-surface p-2 shadow-xl';
  const itemClasses = overlay
    ? 'flex w-full items-center justify-between gap-6 whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-primary-fg hover:bg-primary-fg/10'
    : 'flex w-full items-center justify-between gap-6 whitespace-nowrap rounded-md px-3 py-1.5 text-sm hover:bg-surface-muted';
  const subItemClasses = overlay
    ? 'block whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-primary-fg transition-colors duration-150 hover:bg-primary-fg/10'
    : 'block whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors duration-150 hover:bg-surface-muted';

  return (
    <div className="group relative">
      <button className={`flex items-center gap-1 ${hoverClass}`}>
        Shop
        <ChevronDown />
      </button>

      {/* L1 dropdown panel — smooth fade-in animation */}
      <div className="invisible absolute left-0 top-full pt-2 opacity-0 transition-all duration-300 ease-out transform -translate-y-2 scale-95 group-hover:visible group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100">
        <div className={panelClasses}>
          <ul className="space-y-0.5">
            {SHOP_CATEGORIES.map((c) => {
              const hasSubs = c.subcategories.length > 0;
              return (
                <li key={c.slug} className="bv-dropdown-item group/cat relative">
                  <Link href={`/category/${c.slug}`} className={`${itemClasses} transition-colors duration-150`}>
                    <span>{c.name}</span>
                    {hasSubs && (
                      <span className="opacity-40">
                        <ChevronRight />
                      </span>
                    )}
                  </Link>

                  {/* L2 flyout — slides in from left by 6px, fixed w-48 for consistency */}
                  {hasSubs && (
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
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SiteFooter() {
  return (
    <AnimateOnScroll>
      <footer className="mt-8 border-t border-slate-200/80 bg-[#F0F7FF]/50 py-6">
        <div className="mx-auto grid grid-cols-1 sm:grid-cols-[1fr_auto] items-center justify-between gap-4 max-w-7xl px-6 text-center text-sm text-slate-600 sm:text-left">
          <div>
            <div className="mb-1.5 inline-flex items-center gap-2 user-select-none">
              <span className="font-heading text-lg font-extrabold tracking-tight text-slate-900">
                Bran<span className="text-primary">V</span>
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                • ALL FOR MEN
              </span>
            </div>
            <p className="max-w-2xl text-xs leading-normal text-slate-500">
              BranV is a curated affiliate platform. We never hold inventory, process payments, or fulfill orders. Clicking Buy Now redirects you directly to the retailer&apos;s site.
            </p>
          </div>
          <div className="shrink-0 text-xs font-medium text-slate-400">
            © {new Date().getFullYear()} BranV. All rights reserved.
          </div>
        </div>
      </footer>
    </AnimateOnScroll>
  );
}
