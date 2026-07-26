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
        <div className="min-h-[100dvh] pb-16 lg:pb-0">
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
  const headerBaseClasses = overlay
    ? 'sticky top-0 z-30 bg-white/95 text-slate-800 backdrop-blur border-b border-slate-200 shadow-sm transition-all'
    : 'sticky top-0 z-30 border-b border-slate-200 bg-white/95 text-slate-800 backdrop-blur shadow-sm transition-all';

  const visibilityClasses = 'translate-y-0 opacity-100';

  const linkHoverClass = overlay ? 'hover:text-primary-fg/70' : 'hover:text-primary';

  return (
    <header className={`${headerBaseClasses} ${visibilityClasses}`}>
      {/* Top Header Row */}
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 lg:py-4">
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
      <footer className="mt-20 border-t border-slate-200 bg-[#F0F7FF]/60">
        <div className="mx-auto max-w-7xl gap-10 px-6 py-12 text-sm text-slate-600 md:grid md:grid-cols-[1.5fr_1fr]">
          <div className="bv-enter">
            <div className="mb-4 inline-flex flex-col items-start user-select-none">
              <div className="font-heading text-xl font-extrabold tracking-tight text-slate-900">
                Bran<span className="text-primary">V</span>
              </div>
              <div className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.22em] text-slate-500">
                ALL FOR MEN
              </div>
            </div>
            <p className="max-w-xl text-xs leading-relaxed text-slate-500">
              BranV is a curated affiliate platform. We never hold inventory, never
              process payments, never fulfill orders. When you click Buy Now, you
              are redirected to the retailer&apos;s site to complete your purchase.{' '}
              <strong className="font-semibold text-slate-700">We earn a small commission on qualifying sales, at no extra cost to you.</strong>
            </p>
            <p className="mt-6 text-xs font-medium text-slate-400">
              © {new Date().getFullYear()} BranV. All rights reserved.
            </p>
          </div>
          <div className="bv-enter bv-delay-2 mt-8 md:mt-0">
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
              Newsletter
            </p>
            <p className="mb-4 text-xs font-medium text-slate-500">
              Weekly digest of curated new arrivals and style guides.
            </p>
            <NewsletterSignup source="footer" />
          </div>
        </div>
      </footer>
    </AnimateOnScroll>
  );
}
