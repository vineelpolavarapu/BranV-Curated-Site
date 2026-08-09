import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { apiServer } from '@/lib/api-server';
import { LookbookPublic } from '@/lib/phase7-types';
import { StorefrontShell } from '@/components/StorefrontShell';
import { ShoppableImage } from '@/components/lookbooks/ShoppableImage';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const lb = await apiServer<LookbookPublic>(`/lookbooks/${slug}`);
  if (!lb) return { title: 'BranV - Lookbook' };
  return {
    title: `${lb.title} · BranV Lookbook`,
    description: lb.description ?? undefined,
    openGraph: {
      title: lb.title,
      description: lb.description ?? undefined,
      images: lb.heroUrl ? [lb.heroUrl] : [],
    },
  };
}

export default async function LookbookDetailPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const lb = await apiServer<LookbookPublic>(`/lookbooks/${slug}`);
  if (!lb) notFound();

  return (
    <StorefrontShell>
      {lb.heroUrl && (
        <section className="mx-auto max-w-7xl px-6 pt-4">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-surface-muted">
            <Image
              src={lb.heroUrl}
              alt={lb.title}
              fill
              sizes="(max-width: 1023px) 100vw, 1200px"
              unoptimized
              priority
              className="object-cover"
            />
          </div>
        </section>
      )}

      <section className="mx-auto max-w-3xl px-6 pb-10 pt-6">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {lb.title}
        </h1>
        {lb.description && (
          <p className="mt-3 text-base leading-relaxed text-content-soft">
            {lb.description}
          </p>
        )}
        <p className="mt-2 text-xs text-content-soft">
          Tap any numbered dot to shop the look.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-16">
        {lb.images.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface-muted p-8 text-center text-sm text-content-soft">
            No images yet.
          </p>
        ) : (
          <ul className="space-y-8">
            {lb.images.map((img) => (
              <li key={img.id}>
                <ShoppableImage image={img} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </StorefrontShell>
  );
}
