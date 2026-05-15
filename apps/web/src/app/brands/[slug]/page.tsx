import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { apiServer, buildQuery } from '@/lib/api-server';
import { ProductPage } from '@/lib/storefront-types';
import { BrandStoryPublic } from '@/lib/phase7-types';
import { StorefrontShell } from '@/components/StorefrontShell';
import { ProductCard } from '@/components/ProductCard';
import { Filters, SortPicker } from '@/components/Filters';
import { BrandStorySection } from '@/components/brand/BrandStorySection';

export const dynamic = 'force-dynamic';

interface BrandDetail {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  heroUrl: string | null;
  description: string | null;
  _count: { products: number };
}

export default async function BrandDetailPage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const [brand, list, story] = await Promise.all([
    apiServer<BrandDetail>(`/brands/${slug}`),
    apiServer<ProductPage>(`/products${buildQuery({ ...sp, brand: slug })}`),
    apiServer<BrandStoryPublic | null>(`/brands/${slug}/story`),
  ]);
  if (!brand) notFound();

  return (
    <StorefrontShell>
      <BrandHero brand={brand} />
      {story && <BrandStorySection story={story} />}
      <section className="mx-auto max-w-7xl px-6 pb-12 pt-2">
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <Filters context={{}} />
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-neutral-500">
                {list?.total ?? 0} products
              </p>
              <SortPicker />
            </div>
            {!list || list.data.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center text-sm text-neutral-500">
                No products under this brand match.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                {list.data.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </StorefrontShell>
  );
}

function BrandHero({ brand }: { brand: BrandDetail }) {
  return (
    <section className="border-b border-neutral-200 bg-neutral-50">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-6 py-10 md:flex-row md:items-center">
        {brand.logoUrl && (
          <div className="flex h-20 w-32 items-center justify-center rounded-lg border border-neutral-200 bg-white">
            <Image
              src={brand.logoUrl}
              alt={brand.name}
              width={120}
              height={64}
              unoptimized
              className="max-h-16 w-auto object-contain"
            />
          </div>
        )}
        <div className="flex-1">
          <nav className="mb-2 text-xs text-neutral-500">
            <Link href="/" className="hover:text-neutral-900">Home</Link>
            <span className="mx-2">/</span>
            <Link href="/brands" className="hover:text-neutral-900">Brands</Link>
            <span className="mx-2">/</span>
            <span className="text-neutral-900">{brand.name}</span>
          </nav>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {brand.name}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            {brand._count.products} products on BranV
          </p>
          {brand.description && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-700">
              {brand.description}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
