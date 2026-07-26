'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch, CurrentUser } from '@/lib/api';
import { StorefrontShell } from '@/components/StorefrontShell';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';
import { useWishlist } from '@/components/wishlist/WishlistProvider';
import { getRecentlyViewed, RecentlyViewedItem } from '@/lib/recently-viewed';
import { formatINR } from '@/lib/format';

export default function AccountPage() {
  const router = useRouter();
  const { productIds } = useWishlist();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [disclosure, setDisclosure] = useState<string | null>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await apiFetch<CurrentUser>('/auth/me');
      if (cancelled) return;
      if (!result.ok || !result.data) {
        router.replace('/login?next=/account');
        return;
      }
      setMe(result.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    apiFetch<{ AFFILIATE_DISCLOSURE_TEXT?: string }>('/settings/public').then((res) => {
      if (res.ok && res.data?.AFFILIATE_DISCLOSURE_TEXT) {
        setDisclosure(res.data.AFFILIATE_DISCLOSURE_TEXT);
      }
    });
    setRecentlyViewed(getRecentlyViewed());
  }, []);

  async function onLogout() {
    await apiFetch('/auth/logout', { method: 'POST' });
    router.replace('/');
    router.refresh();
  }

  if (!me) {
    return (
      <StorefrontShell>
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="h-8 w-56 animate-pulse rounded bg-line" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-surface-muted" />
            ))}
          </div>
        </div>
      </StorefrontShell>
    );
  }

  const displayName =
    [me.profile?.firstName, me.profile?.lastName].filter(Boolean).join(' ') ||
    me.email;
  const initials =
    [me.profile?.firstName?.[0], me.profile?.lastName?.[0]]
      .filter(Boolean)
      .join('')
      .toUpperCase() || me.email[0].toUpperCase();
  const memberSince = new Date(me.createdAt).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <StorefrontShell>
      <section className="mx-auto max-w-5xl px-6 py-8 md:py-12">
        {/* Profile header card */}
        <AnimateOnScroll>
          <div className="bv-enter flex flex-col items-start justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center md:p-8 shadow-sm">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-extrabold tracking-wide text-white shadow-md md:h-20 md:w-20 md:text-2xl">
                {initials}
              </div>
              <div className="min-w-0">
                <h1 className="truncate font-heading text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
                  {displayName}
                </h1>
                <p className="truncate text-sm font-medium text-slate-500">{me.email}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2.5">
                  <span className="text-xs font-medium text-slate-400">
                    Member since {memberSince}
                  </span>
                  {!me.emailVerified && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 border border-amber-200">
                      EMAIL UNVERIFIED
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-full shrink-0 rounded-full border border-slate-200 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 sm:w-auto"
            >
              Sign out
            </button>
          </div>
        </AnimateOnScroll>

        {/* Quick nav */}
        <AnimateOnScroll>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NavCard
              href="/wishlist"
              label="Wishlist"
              value={productIds.size}
              icon={HeartIcon}
              delay={1}
            />
            <NavCard href="/wardrobe" label="My Wardrobe" icon={WardrobeIcon} delay={2} />
            <NavCard
              href="/account/notifications"
              label="Notifications"
              icon={BellIcon}
              delay={3}
            />
            <NavCard
              href="/account/preferences"
              label="Preferences"
              icon={SlidersIcon}
              delay={4}
            />
          </div>
        </AnimateOnScroll>

        {/* Recently viewed */}
        <AnimateOnScroll>
          <div className="bv-enter mt-10">
            <h2 className="mb-4 text-lg font-semibold tracking-tight text-content">
              Recently viewed
            </h2>
            {recentlyViewed.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-surface-muted p-8 text-center text-sm text-content-soft">
                Products you view will show up here.
              </div>
            ) : (
              <ul className="-mx-6 flex gap-4 overflow-x-auto px-6 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-6">
                {recentlyViewed.map((item) => (
                  <li key={item.slug} className="w-32 shrink-0 sm:w-auto">
                    <Link href={`/products/${item.slug}`} className="group block">
                      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-surface-muted">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.title}
                            fill
                            sizes="140px"
                            unoptimized
                            className="object-cover transition-transform duration-200 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-content-muted">
                            no image
                          </div>
                        )}
                      </div>
                      <p className="mt-2 truncate text-xs text-content-soft">{item.brandName}</p>
                      <p className="truncate text-sm font-medium text-content">{item.title}</p>
                      <p className="text-sm font-semibold text-content">
                        ₹{formatINR(item.price)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </AnimateOnScroll>

        {/* Help & legal */}
        <AnimateOnScroll>
          <div className="bv-enter mt-10">
            <h2 className="mb-4 text-lg font-semibold tracking-tight text-content">
              Support
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <NavCard href="/help" label="Help Center" icon={HelpCircleIcon} wide />
              <NavCard href="/terms" label="Terms & Conditions" icon={DocIcon} wide />
            </div>
          </div>
        </AnimateOnScroll>

        {/* Affiliate disclosure */}
        {disclosure && (
          <AnimateOnScroll>
            <div className="bv-enter-fade mt-8 rounded-xl border border-line bg-surface-muted p-5 text-xs leading-relaxed text-content-soft">
              {disclosure}
            </div>
          </AnimateOnScroll>
        )}
      </section>
    </StorefrontShell>
  );
}

function NavCard({
  href,
  label,
  value,
  icon: Icon,
  delay,
  wide,
}: {
  href: string;
  label: string;
  value?: number;
  icon: (props: { className?: string }) => React.ReactElement;
  delay?: number;
  wide?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`bv-enter${delay ? ` bv-delay-${Math.min(delay, 7)}` : ''} group flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-4.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-md ${
        wide ? 'justify-between' : 'flex-col text-center sm:flex-row sm:text-left'
      }`}
    >
      <span className="flex items-center gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
          <Icon className="h-5 w-5" />
        </span>
        <span className="flex flex-col">
          <span className="font-heading text-sm font-bold text-slate-800 group-hover:text-primary transition-colors">{label}</span>
          {value !== undefined && (
            <span className="text-xs font-medium text-slate-500">{value} saved</span>
          )}
        </span>
      </span>
      <ChevronRightIcon className="hidden h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary sm:block" />
    </Link>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-7-4.5-9-9.5C1 6 6 3 9 6c1 1 3 2 3 2s2-1 3-2c3-3 8 0 6 5.5C19 16.5 12 21 12 21z" />
    </svg>
  );
}

function WardrobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 4h16v16H4zM4 12h16M10 8v2M14 8v2" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

function SlidersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="11" cy="18" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function HelpCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.3a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2-2.4 3.5" />
      <circle cx="12" cy="16.7" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function DocIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
