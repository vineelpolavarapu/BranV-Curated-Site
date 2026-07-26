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
          <p className="bv-enter-fade bv-delay-1 mt-1 text-sm text-content-soft">
            {tag
              ? `Showing articles tagged "${tag}"`
              : 'Editorial, opinionated, and AI-illustrated.'}
          </p>
        </section>
      </AnimateOnScroll>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        {!list || list.data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface-muted p-10 text-center text-sm text-content-soft">
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
    <article className="group flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.08)] rounded-xl p-3 bg-surface border border-transparent hover:border-neutral-100">
      <Link
        href={`/articles/${article.slug}`}
        className="relative block aspect-[16/10] w-full overflow-hidden rounded-lg bg-surface-muted"
      >
        {article.heroUrl ? (
          <Image
            src={article.heroUrl}
            alt={article.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1080px) 50vw, 33vw"
            unoptimized
            className="object-cover transition-transform duration-400 ease-in-out group-hover:scale-[1.05]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-content-muted">
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
                className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-content-soft hover:bg-line"
              >
                {t}
              </Link>
            ))}
          </div>
        )}
        <Link
          href={`/articles/${article.slug}`}
          className="text-lg font-semibold leading-snug tracking-tight text-content underline decoration-transparent hover:decoration-neutral-900 underline-offset-4 transition-[text-decoration-color] duration-200"
        >
          {article.title}
        </Link>
        {article.excerpt && (
          <p className="mt-2 line-clamp-3 text-sm text-content-soft">
            {article.excerpt}
          </p>
        )}
        <p className="mt-3 text-xs text-content-soft opacity-70 transition-opacity duration-200 group-hover:opacity-100">
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
