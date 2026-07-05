import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { apiServer } from '@/lib/api-server';
import { EditDetail } from '@/lib/phase7-types';
import { StorefrontShell } from '@/components/StorefrontShell';
import { EmbeddedProductCard } from '@/components/article/EmbeddedProductCard';

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

export default async function EditDetailPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const edit = await apiServer<EditDetail>(`/edits/${slug}`);
  if (!edit) notFound();

  return (
    <StorefrontShell>
      <nav className="mx-auto max-w-7xl px-6 pt-6 text-xs text-neutral-500">
        <Link href="/" className="hover:text-neutral-900">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/edits" className="hover:text-neutral-900">The Edit</Link>
        <span className="mx-2">/</span>
        <span className="text-neutral-900">{edit.title}</span>
      </nav>

      <section className="mx-auto max-w-7xl px-6 pt-4">
        {edit.heroUrl && (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-neutral-100">
            <Image
              src={edit.heroUrl}
              alt={edit.title}
              fill
              sizes="(max-width: 1023px) 100vw, 1200px"
              unoptimized
              priority
              className="object-cover"
            />
          </div>
        )}
        <div className="mt-6 max-w-3xl">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
            The Edit
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            {edit.title}
          </h1>
          {edit.description && (
            <p className="mt-3 text-base leading-relaxed text-neutral-600">
              {edit.description}
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-10">
        {edit.products.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
            No products in this edit yet.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {edit.products.map((p) => (
              <li key={p.slug}>
                <EmbeddedProductCard product={p} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </StorefrontShell>
  );
}
