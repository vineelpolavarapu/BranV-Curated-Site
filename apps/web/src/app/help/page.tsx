'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { StorefrontShell } from '@/components/StorefrontShell';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';

interface FaqItem {
  q: string;
  a: string;
}

interface FaqCategory {
  key: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactElement;
  items: FaqItem[];
}

const CATEGORIES: FaqCategory[] = [
  {
    key: 'how-it-works',
    label: 'How BranV works',
    icon: SparkleIcon,
    items: [
      {
        q: 'What exactly is BranV?',
        a: 'BranV is a curated affiliate fashion platform. We handpick products from trusted retailers and brands, style them on AI-generated avatars, and help you find things worth buying. We don’t manufacture, stock, or sell anything ourselves.',
      },
      {
        q: 'Why was I redirected to another website when I clicked Buy Now?',
        a: 'Every product on BranV is sold by the retailer, not by us. Tapping "Buy Now" takes you to that retailer’s own site to complete the purchase under their pricing, payment, and checkout flow.',
      },
      {
        q: 'Does BranV make money from my purchase?',
        a: 'Yes. When you buy through a link on BranV, we may earn a small commission from the retailer, at no extra cost to you. This is disclosed on every product page.',
      },
      {
        q: 'What are the AI-rendered images I see on products?',
        a: 'Some product photography is styled on AI-generated avatars to give you a better sense of fit and styling. These are always labeled "AI-rendered"; actual color, fit, and packaging depend on the retailer’s real product.',
      },
    ],
  },
  {
    key: 'orders-returns',
    label: 'Orders, payments & returns',
    icon: PackageIcon,
    items: [
      {
        q: 'How do I track my order?',
        a: 'Since your purchase happens on the retailer’s website, order tracking is handled entirely by that retailer. Check the confirmation email they sent you, or log into your account on their site.',
      },
      {
        q: 'How do I return or exchange something I bought?',
        a: 'Returns, exchanges, and refunds are handled by the retailer you purchased from, under their own return policy. BranV never processes payments or fulfills orders, so we can’t initiate a return on your behalf. Contact the retailer directly using the order confirmation they sent you.',
      },
      {
        q: 'My payment was charged but I never got a confirmation. What do I do?',
        a: 'Since BranV never processes payments, this would be a matter for the retailer’s own payment provider or customer support. If you’re not sure which retailer to contact, check your bank/card statement for the merchant name.',
      },
    ],
  },
  {
    key: 'account',
    label: 'Account & login',
    icon: UserGearIcon,
    items: [
      {
        q: 'How do I reset my password?',
        a: 'From the login page, choose "Forgot password" and follow the emailed reset link.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Reach out via the contact options below and we’ll process your account and data deletion request.',
      },
      {
        q: 'How does Wardrobe work?',
        a: 'Wardrobe is a personal log built from purchases you’ve self-reported after clicking through to a retailer. It’s not verified against the retailer’s actual order records, since we don’t have access to those.',
      },
    ],
  },
  {
    key: 'wishlist',
    label: 'Wishlist & notifications',
    icon: HeartGearIcon,
    items: [
      {
        q: 'How do price-drop alerts work?',
        a: 'Turn on "Notify on price drop" for any item in your Wishlist and we’ll email you if we detect the retailer has lowered the price.',
      },
      {
        q: 'Can I control which notifications I get?',
        a: 'Yes, manage email and in-app notification types from Account → Notification preferences.',
      },
    ],
  },
];

export default function HelpCenterPage() {
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATEGORIES;
    return CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (it) => it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q),
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [query]);

  return (
    <StorefrontShell>
      {/* Hero */}
      <section className="border-b border-line bg-surface-muted">
        <div className="mx-auto max-w-3xl px-6 py-14 text-center md:py-20">
          <AnimateOnScroll>
            <p className="bv-enter-fade text-xs font-medium uppercase tracking-[0.18em] text-content-soft">
              Help Center
            </p>
            <h1 className="bv-enter mt-2 text-3xl font-semibold tracking-tight md:text-5xl">
              How can we help?
            </h1>
            <p className="bv-enter-fade mt-3 text-sm text-content-soft md:text-base">
              Search our FAQs, or browse by topic below.
            </p>

            <div className="bv-enter-fade mx-auto mt-7 max-w-lg">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for a topic, e.g. “returns” or “price drop”"
                  className="w-full rounded-full border border-line bg-surface py-3 pl-11 pr-4 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Category quick-links */}
      <section className="mx-auto max-w-5xl px-6 py-8 grid grid-cols-1 gap-y-6">
        <AnimateOnScroll>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {CATEGORIES.map((cat, i) => (
              <a
                key={cat.key}
                href={`#${cat.key}`}
                className={`bv-enter bv-delay-${Math.min(i + 1, 7)} group flex flex-col items-center gap-2 rounded-xl border border-line bg-surface p-5 text-center transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md`}
              >
                <cat.icon className="h-6 w-6 text-content-soft transition-colors group-hover:text-primary" />
                <span className="text-sm font-medium text-content">{cat.label}</span>
              </a>
            ))}
          </div>
        </AnimateOnScroll>
      </section>

      {/* FAQ list */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface-muted p-10 text-center text-sm text-content-soft">
            No results for “{query}”. Try a different search, or contact us below.
          </div>
        ) : (
          <div className="space-y-10">
            {filtered.map((cat) => (
              <div key={cat.key} id={cat.key} className="scroll-mt-24">
                <div className="mb-3 flex items-center gap-2">
                  <cat.icon className="h-5 w-5 text-content-soft" />
                  <h2 className="text-lg font-semibold tracking-tight text-content">
                    {cat.label}
                  </h2>
                </div>
                <div className="divide-y divide-line rounded-xl border border-line bg-surface">
                  {cat.items.map((item) => {
                    const itemKey = `${cat.key}::${item.q}`;
                    const open = openKey === itemKey;
                    return (
                      <div key={itemKey}>
                        <button
                          type="button"
                          onClick={() => setOpenKey(open ? null : itemKey)}
                          aria-expanded={open}
                          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                        >
                          <span className="text-sm font-medium text-content">{item.q}</span>
                          <ChevronIcon
                            className={`h-4 w-4 shrink-0 text-content-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                          />
                        </button>
                        <div
                          className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                          }`}
                        >
                          <div className="overflow-hidden">
                            <p className="px-5 pb-4 text-sm leading-relaxed text-content-soft">
                              {item.a}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Contact */}
      <section className="border-t border-line bg-surface-muted">
        <div className="mx-auto max-w-3xl px-6 py-14 text-center">
          <AnimateOnScroll>
            <h2 className="bv-enter text-xl font-semibold tracking-tight">Still need help?</h2>
            <p className="bv-enter-fade mt-2 text-sm text-content-soft">
              Our team is happy to help with anything not covered above.
            </p>
            <div className="bv-enter mt-6 flex flex-wrap items-center justify-center gap-3">
              <a
                href="mailto:hello@branv.in"
                className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-fg transition hover:bg-primary-hover"
              >
                Email hello@branv.in
              </a>
              <Link
                href="/terms"
                className="rounded-md border border-line bg-surface px-5 py-2.5 text-sm font-medium text-content transition hover:bg-surface-muted"
              >
                Read Terms &amp; Conditions
              </Link>
            </div>
          </AnimateOnScroll>
        </div>
      </section>
    </StorefrontShell>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </svg>
  );
}

function PackageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </svg>
  );
}

function UserGearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="7" r="3.5" />
      <path d="M2.5 20c.7-3.3 3.7-5.3 6.5-5.3" />
      <circle cx="17.5" cy="16.5" r="2.8" />
      <path d="M17.5 12.3v1M17.5 19.7v1M13.7 16.5h1M20.3 16.5h1M14.7 13.7l.7.7M19.6 18.6l.7.7M14.7 19.3l.7-.7M19.6 14.4l.7-.7" />
    </svg>
  );
}

function HeartGearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20s-6.5-4.2-8.4-8.6C2.4 8 4.8 5 7.7 5c1.7 0 3.1 1 4.3 2.3C13.2 6 14.6 5 16.3 5c2.9 0 5.3 3 4.1 6.4-.5 1.4-1.3 2.7-2.2 3.9" />
      <circle cx="18" cy="18" r="3" />
    </svg>
  );
}
