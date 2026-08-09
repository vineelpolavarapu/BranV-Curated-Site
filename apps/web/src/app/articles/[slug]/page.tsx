import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { apiServer } from '@/lib/api-server';
import { ArticleDetail, ArticleSummary } from '@/lib/article-types';
import { StorefrontShell } from '@/components/StorefrontShell';
import { ArticleBody } from '@/components/article/ArticleBody';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const article = await apiServer<ArticleDetail>(`/articles/${slug}`);
  if (!article) return { title: 'BranV - Article' };
  const title = article.metaTitle ?? `${article.title} · BranV`;
  const desc =
    article.metaDescription ??
    article.excerpt ??
    `${article.title} - BranV editorial.`;
  return {
    title,
    description: desc,
    openGraph: {
      title: article.title,
      description: desc,
      type: 'article',
      images: article.ogImage
        ? [article.ogImage]
        : article.heroUrl
          ? [article.heroUrl]
          : [],
      publishedTime: article.publishedAt ?? undefined,
      tags: article.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: desc,
    },
  };
}

export default async function ArticleDetailPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const [article, related] = await Promise.all([
    apiServer<ArticleDetail>(`/articles/${slug}`),
    apiServer<ArticleSummary[]>(`/articles/${slug}/related`),
  ]);
  if (!article) notFound();

  return (
    <StorefrontShell>
      <ArticleSchema article={article} />
      <article className="mx-auto max-w-3xl px-6 pb-12 pt-6">
        <Header article={article} />
        {article.heroUrl && (
          <div className="relative mt-6 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-surface-muted">
            <Image
              src={article.heroUrl}
              alt={article.title}
              fill
              sizes="(max-width: 1023px) 100vw, 768px"
              unoptimized
              priority
              className="object-cover"
            />
          </div>
        )}
        <div className="mt-8">
          <ArticleBody
            bodyMd={article.bodyMd}
            embeddedProducts={article.embeddedProducts}
          />
        </div>
        <AffiliateDisclosure />
        {article.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-1">
            {article.tags.map((t) => (
              <Link
                key={t}
                href={`/articles?tag=${encodeURIComponent(t)}`}
                className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-content-soft hover:bg-line"
              >
                {t}
              </Link>
            ))}
          </div>
        )}
      </article>

      {related && related.length > 0 && (
        <section className="mx-auto max-w-3xl px-6 pb-16">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">
            Related reading
          </h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {related.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/articles/${r.slug}`}
                  className="block rounded-xl border border-line bg-surface p-4 hover:border-primary/40"
                >
                  <p className="text-sm font-medium leading-snug">{r.title}</p>
                  <p className="mt-1 text-[11px] text-content-soft">
                    {r.readingMinutes !== null && `${r.readingMinutes} min read`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </StorefrontShell>
  );
}

function Header({ article }: { article: ArticleDetail }) {
  return (
    <header className="mt-4">
      <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
        {article.title}
      </h1>
      {article.excerpt && (
        <p className="mt-3 text-lg leading-relaxed text-content-soft">
          {article.excerpt}
        </p>
      )}
      <p className="mt-4 text-xs text-content-soft">
        By Vineel
        {article.publishedAt && (
          <>
            {' · '}
            <time dateTime={article.publishedAt}>
              {new Date(article.publishedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          </>
        )}
        {article.readingMinutes !== null && (
          <> · {article.readingMinutes} min read</>
        )}
      </p>
    </header>
  );
}

function AffiliateDisclosure() {
  return (
    <p className="not-prose mt-10 rounded-md bg-surface-muted px-3 py-2 text-xs text-content-soft">
      <strong className="text-content">Affiliate disclosure:</strong>{' '}
      Product links on BranV are affiliate links. We earn a small commission on
      qualifying sales - at no extra cost to you.
    </p>
  );
}

function ArticleSchema({ article }: { article: ArticleDetail }) {
  const ld = {
    '@context': 'https://schema.org/',
    '@type': 'Article',
    headline: article.title,
    description: article.metaDescription ?? article.excerpt ?? undefined,
    image: article.heroUrl ?? article.ogImage ?? undefined,
    datePublished: article.publishedAt ?? undefined,
    author: { '@type': 'Person', name: 'Vineel' },
    publisher: {
      '@type': 'Organization',
      name: 'BranV',
    },
    mentions: article.embeddedProducts.map((p) => ({
      '@type': 'Product',
      name: p.title,
      url: `${getBase()}/products/${p.slug}`,
      brand: p.brand.name,
    })),
    keywords: article.tags.join(', '),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
    />
  );
}

function getBase(): string {
  // Best-effort canonical base for schema URLs - falls back to localhost in dev.
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.WEB_ORIGIN ??
    'http://localhost:3000'
  );
}
