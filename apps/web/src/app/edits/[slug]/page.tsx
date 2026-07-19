import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { apiServer } from '@/lib/api-server';
import { EditDetail } from '@/lib/phase7-types';
import { StorefrontShell } from '@/components/StorefrontShell';
import { EmbeddedProductCard } from '@/components/article/EmbeddedProductCard';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const edit = await apiServer<EditDetail>(`/edits/${slug}`);
  if (!edit) return { title: 'BranV — The Edit' };
  return {
    title: `${edit.title} · The Edit · BranV`,
    description: edit.description ?? 'A curated edit on BranV.',
    openGraph: {
      title: edit.title,
      description: edit.description ?? undefined,
      images: edit.heroUrl ? [edit.heroUrl] : [],
    },
  };
}

const PRODUCT_STAGGER = ['bv-delay-1', 'bv-delay-2', 'bv-delay-3', 'bv-delay-4', 'bv-delay-5', 'bv-delay-6'];

export default async function EditDetailPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const edit = await apiServer<EditDetail>(`/edits/${slug}`);
  if (!edit) notFound();

  return (
    <StorefrontShell>
      <AnimateOnScroll>
        <nav className="bv-enter-fade mx-auto max-w-7xl px-6 pt-6 text-xs text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/shop" className="hover:text-neutral-900">Shop</Link>
          <span className="mx-2">/</span>
          <span className="text-neutral-900">{edit.title}</span>
        </nav>
      </AnimateOnScroll>

      <section className="mx-auto max-w-7xl px-6 pt-4 sm:pt-6">
        {edit.heroUrl && (
          <AnimateOnScroll>
            <div className="bv-enter-fade relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-neutral-900 sm:aspect-[21/9]">
              <Image
                src={edit.heroUrl}
                alt={edit.title}
                fill
                sizes="(max-width: 1023px) 100vw, 1200px"
                unoptimized
                priority
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">
                  The Edit
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
                  {edit.title}
                </h1>
              </div>
            </div>
          </AnimateOnScroll>
        )}

        <AnimateOnScroll>
          <div className="bv-enter mt-6 max-w-3xl sm:mt-8">
            {!edit.heroUrl && (
              <>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                  The Edit
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
                  {edit.title}
                </h1>
              </>
            )}
            {edit.description && (
              <p className="mt-3 text-base leading-relaxed text-neutral-600">
                {edit.description}
              </p>
            )}
          </div>
        </AnimateOnScroll>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-10">
        {edit.products.length === 0 ? (
          <AnimateOnScroll>
            <div className="bv-enter flex flex-col items-center gap-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center sm:p-16">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-200 text-neutral-500">
                <BagIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-medium text-neutral-700">
                  This edit is being curated right now.
                </p>
                <p className="mt-1 text-sm text-neutral-500">
                  Check back soon, or explore everything we have in the meantime.
                </p>
              </div>
              <Link
                href="/shop"
                className="mt-1 rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
              >
                Browse all categories
              </Link>
            </div>
          </AnimateOnScroll>
        ) : (
          <AnimateOnScroll>
            <ul className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {edit.products.map((p, i) => (
                <li key={p.slug} className={`bv-enter ${PRODUCT_STAGGER[i % PRODUCT_STAGGER.length] ?? ''}`}>
                  <EmbeddedProductCard product={p} />
                </li>
              ))}
            </ul>
          </AnimateOnScroll>
        )}
      </section>
    </StorefrontShell>
  );
}

function BagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 7h12l-1 13H7L6 7zM9 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  );
}
