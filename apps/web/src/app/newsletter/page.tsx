import { StorefrontShell } from '@/components/StorefrontShell';
import { NewsletterSignup } from '@/components/newsletter/NewsletterSignup';

export const metadata = {
  title: 'Newsletter · BranV',
  description: 'Get the weekly BranV digest.',
};

export default function NewsletterPage() {
  return (
    <StorefrontShell>
      <section className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
          Subscribe
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          The BranV weekly
        </h1>
        <p className="mt-3 text-base leading-relaxed text-neutral-600">
          Top new products, the article we&apos;re proudest of, drops landing
          this week, and the current Edit. One email, easy unsubscribe.
        </p>
        <div className="mt-8">
          <NewsletterSignup source="page" variant="page" />
        </div>
        <p className="mt-6 text-xs text-neutral-500">
          We use double opt-in — you&apos;ll get a confirmation link before
          we add you to the list.
        </p>
      </section>
    </StorefrontShell>
  );
}
