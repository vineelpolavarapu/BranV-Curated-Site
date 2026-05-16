import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { apiServer } from '@/lib/api-server';
import { DropDetail, DropDetailProduct } from '@/lib/phase7-types';
import { StorefrontShell } from '@/components/StorefrontShell';
import { formatINR } from '@/lib/format';
import { Countdown } from '@/components/drops/Countdown';
import { NotifyMeForm } from '@/components/drops/NotifyMeForm';
import { EmbeddedProductCard } from '@/components/article/EmbeddedProductCard';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const drop = await apiServer<DropDetail>(`/drops/${slug}`);
  if (!drop) return { title: 'BranV — Drop' };
  return {
    title: `${drop.name} · BranV Drop`,
    description: drop.description ?? `A curated drop on BranV.`,
    openGraph: {
      title: drop.name,
      description: drop.description ?? undefined,
      images: drop.heroUrl ? [drop.heroUrl] : [],
    },
  };
}

export default async function DropDetailPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const drop = await apiServer<DropDetail>(`/drops/${slug}`);
  if (!drop) notFound();

  return (
    <StorefrontShell>
      <Breadcrumbs name={drop.name} />
      <Hero drop={drop} />
      {drop.status === 'SCHEDULED' && <PreLaunch drop={drop} />}
      {drop.status === 'LIVE' && <LiveBody drop={drop} />}
      {drop.status === 'ENDED' && <EndedBody drop={drop} />}
    </StorefrontShell>
  );
}

function Breadcrumbs({ name }: { name: string }) {
  return (
    <nav className="mx-auto max-w-7xl px-6 pt-6 text-xs text-neutral-500">
      <Link href="/" className="hover:text-neutral-900">Home</Link>
      <span className="mx-2">/</span>
      <Link href="/drops" className="hover:text-neutral-900">Drops</Link>
      <span className="mx-2">/</span>
      <span className="text-neutral-900">{name}</span>
    </nav>
  );
}

function Hero({ drop }: { drop: DropDetail }) {
  return (
    <section className="mx-auto max-w-7xl px-6 pt-4">
      {drop.heroUrl && (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-neutral-100">
          <Image
            src={drop.heroUrl}
            alt={drop.name}
            fill
            sizes="(max-width: 768px) 100vw, 1200px"
            unoptimized
            priority
            className="object-cover"
          />
          {drop.status === 'LIVE' && (
            <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white">
              <span className="h-2 w-2 rounded-full bg-white" />
              Live now
            </span>
          )}
        </div>
      )}
      <div className="mt-6 max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {drop.name}
        </h1>
        {drop.description && (
          <p className="mt-3 text-base leading-relaxed text-neutral-600">
            {drop.description}
          </p>
        )}
      </div>
    </section>
  );
}

function PreLaunch({ drop }: { drop: DropDetail }) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-12 text-center">
      <Countdown target={drop.launchAt} label="Launches in" />
      <p className="mt-6 text-sm text-neutral-600">
        Get an email the moment it goes live.
      </p>
      <div className="mt-3 flex justify-center">
        <NotifyMeForm dropSlug={drop.slug} />
      </div>
    </section>
  );
}

function LiveBody({ drop }: { drop: DropDetail }) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      {drop.endsAt && (
        <div className="mb-8">
          <Countdown target={drop.endsAt} label="Ends in" />
        </div>
      )}
      <h2 className="mb-5 text-xl font-semibold tracking-tight">
        Shop the drop
      </h2>
      {drop.products.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
          The curator hasn&apos;t added products to this drop yet.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {drop.products.map((p) => (
            <li key={p.slug}>
              <EmbeddedProductCard product={p} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EndedBody({ drop }: { drop: DropDetail }) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center">
        <p className="text-sm font-medium text-neutral-700">
          This drop has ended.
        </p>
        <Link
          href="/drops"
          className="mt-3 inline-block text-sm font-medium text-neutral-900 underline"
        >
          See the next one →
        </Link>
      </div>
      {drop.products.length > 0 && (
        <>
          <h2 className="mb-5 mt-10 text-xl font-semibold tracking-tight">
            What was in the drop
          </h2>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {drop.products.map((p) => (
              <li key={p.slug}>
                <ProductMiniCard product={p} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function ProductMiniCard({ product }: { product: DropDetailProduct }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="block opacity-70 transition hover:opacity-100"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-neutral-100">
        {product.primaryImage ? (
          <Image
            src={product.primaryImage.url}
            alt={product.primaryImage.altText ?? product.title}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            unoptimized
            className="object-cover"
          />
        ) : null}
      </div>
      <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
        {product.brand.name}
      </p>
      <p className="text-sm font-medium">{product.title}</p>
      <p className="mt-0.5 text-xs text-neutral-600">
        ₹{formatINR(product.price)}
      </p>
    </Link>
  );
}
