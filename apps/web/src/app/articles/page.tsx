import Link from 'next/link';
import Image from 'next/image';
import { apiServer, buildQuery } from '@/lib/api-server';
import { ArticleSummary } from '@/lib/article-types';
import { StorefrontShell } from '@/components/StorefrontShell';
import { AnimateOnScroll } from '@/components/AnimateOnScroll';

export const dynamic = 'force-dynamic';

interface ArticleList {
  data: ArticleSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const metadata = {
  title: 'Articles · BranV',
  description: 'Editorial, opinionated guides and roundups by Vineel.',
};

export default async function ArticlesIndexPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const tag = typeof sp.tag === 'string' ? sp.tag : undefined;
  const list = await apiServer<ArticleList>(
    `/articles${buildQuery({ ...sp, pageSize: 24 })}`,
  );

  return (
    <StorefrontShell>
      <AnimateOnScroll>
        <section className="mx-auto max-w-7xl px-6 py-10">
          <h1 className="bv-enter text-3xl font-semibold tracking-tight md:text-4xl">
            Articles
          </h1>
          <p className="bv-enter-fade bv-delay-1 mt-1 text-sm text-neutral-600">
            {tag
              ? `Showing articles tagged "${tag}"`
              : 'Editorial, opinionated, and AI-illustrated.'}
          </p>
        </section>
      </AnimateOnScroll>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        {!list || list.data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center text-sm text-neutral-500">
            No articles yet.
          </div>
        ) : (
          <AnimateOnScroll>
            <ul className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {list.data.map((a, i) => (
                <li key={a.id} className={`bv-enter bv-delay-${(i % 3) + 1}`}>
                  <ArticleCard article={a} />
                </li>
              ))}
            </ul>
          </AnimateOnScroll>
        )}
      </section>
    </StorefrontShell>
  );
}

function ArticleCard({ article }: { article: ArticleSummary }) {
  return (
    <article className="group flex flex-col transition-transform duration-200 hover:-translate-y-1">
      <Link
        href={`/articles/${article.slug}`}
        className="relative block aspect-[16/10] w-full overflow-hidden rounded-xl bg-neutral-100"
      >
        {article.heroUrl ? (
          <Image
            src={article.heroUrl}
            alt={article.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized
            className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300">
            no hero
          </div>
        )}
      </Link>
      <div className="mt-4 flex flex-1 flex-col">
        {article.tags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {article.tags.slice(0, 3).map((t) => (
              <Link
                key={t}
                href={`/articles?tag=${encodeURIComponent(t)}`}
                className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-700 hover:bg-neutral-200"
              >
                {t}
              </Link>
            ))}
          </div>
        )}
        <Link
          href={`/articles/${article.slug}`}
          className="text-lg font-semibold leading-snug tracking-tight text-neutral-900 underline-offset-2 transition-[text-decoration-color] duration-200 hover:underline"
        >
          {article.title}
        </Link>
        {article.excerpt && (
          <p className="mt-2 line-clamp-3 text-sm text-neutral-600">
            {article.excerpt}
          </p>
        )}
        <p className="mt-3 text-xs text-neutral-500">
          {article.publishedAt &&
            new Date(article.publishedAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          {article.readingMinutes !== null && (
            <span> · {article.readingMinutes} min read</span>
          )}
        </p>
      </div>
    </article>
  );
}
