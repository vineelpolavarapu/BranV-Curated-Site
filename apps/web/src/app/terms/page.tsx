import type { Metadata } from 'next';
import Link from 'next/link';
import { StorefrontShell } from '@/components/StorefrontShell';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';

export const metadata: Metadata = {
  title: 'Terms & Conditions · BranV',
  description: 'The terms that govern your use of BranV, a curated affiliate fashion platform.',
};

const SECTIONS: Array<{ heading: string; body: string[] }> = [
  {
    heading: '1. What BranV is',
    body: [
      'BranV is a curated affiliate fashion platform. We showcase products from third-party retailers and brands, styled on AI-generated avatars, to help you discover things worth buying.',
      'BranV does not manufacture, stock, sell, ship, or otherwise fulfill any product shown on the site. We never hold inventory, never process payments on our own platform, and never handle order fulfillment ourselves.',
    ],
  },
  {
    heading: '2. How a purchase actually works',
    body: [
      'When you tap "Buy Now" on a product, we redirect you to the retailer’s own website to complete the purchase there, under that retailer’s own terms, pricing, and policies.',
      'BranV earns a small affiliate commission on qualifying purchases made this way, at no extra cost to you. This relationship is disclosed on every product page and does not influence which products we choose to feature.',
      'Because the transaction happens entirely on the retailer’s site, BranV is not a party to that sale. Order confirmation, payment, shipping, delivery timelines, returns, refunds, and customer support for that purchase are handled exclusively by the retailer, not by BranV.',
    ],
  },
  {
    heading: '3. Accounts',
    body: [
      'You need an account to use features like Wishlist, Wardrobe, and notification preferences. You’re responsible for keeping your login credentials secure and for all activity under your account.',
      'You can request account or data deletion at any time from Account settings or by contacting us through the Help Center.',
    ],
  },
  {
    heading: '4. Wishlist, Wardrobe, and self-reported purchases',
    body: [
      'Wishlist lets you save products you’re interested in and optionally get notified on price drops. Wardrobe is a personal log of items you’ve told us you bought, built from your own self-reported confirmations after a retailer redirect. It is not verified against any retailer’s actual order records, since BranV never has access to those.',
    ],
  },
  {
    heading: '5. Content and AI-generated imagery',
    body: [
      'Product photography styled on AI-generated avatars is clearly labeled "AI-rendered" wherever shown. This imagery is for styling reference only. Actual retailer packaging, fit, and color may vary, so always check the retailer’s own listing before purchasing.',
    ],
  },
  {
    heading: '6. No warranty on third-party products or retailers',
    body: [
      'BranV makes no warranty, express or implied, about the quality, safety, legality, or availability of any product or retailer we link to. Your purchase is governed entirely by that retailer’s own terms of sale, warranty, and return policy.',
    ],
  },
  {
    heading: '7. Changes to these terms',
    body: [
      'We may update these terms as BranV’s features evolve. Continued use of the site after a change means you accept the updated terms. Material changes will be reflected with an updated date on this page.',
    ],
  },
  {
    heading: '8. Contact',
    body: [
      'Questions about these terms? Visit the Help Center or reach out through the contact options listed there.',
    ],
  },
];

export default function TermsPage() {
  return (
    <StorefrontShell>
      <section className="mx-auto max-w-3xl px-6 py-10 md:py-14 grid grid-cols-1 gap-y-6">
        <AnimateOnScroll>
          <p className="bv-enter-fade text-xs font-medium uppercase tracking-[0.18em] text-content-soft">
            Legal
          </p>
          <h1 className="bv-enter mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            Terms &amp; Conditions
          </h1>
          <p className="bv-enter-fade mt-3 text-sm text-content-soft">
            Last updated {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </AnimateOnScroll>

        <div className="mt-10 space-y-9">
          {SECTIONS.map((s, i) => (
            <AnimateOnScroll key={s.heading}>
              <div className={`bv-enter bv-delay-${Math.min(i + 1, 7)}`}>
                <h2 className="text-lg font-semibold tracking-tight text-content">
                  {s.heading}
                </h2>
                <div className="mt-2 space-y-3">
                  {s.body.map((p, pi) => (
                    <p key={pi} className="text-sm leading-relaxed text-content-soft">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            </AnimateOnScroll>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-line bg-surface-muted p-6 text-sm text-content-soft">
          Still have questions?{' '}
          <Link href="/help" className="font-medium text-content underline underline-offset-2">
            Visit the Help Center
          </Link>{' '}
          or check our{' '}
          <Link href="/account" className="font-medium text-content underline underline-offset-2">
            account settings
          </Link>
          .
        </div>
      </section>
    </StorefrontShell>
  );
}
