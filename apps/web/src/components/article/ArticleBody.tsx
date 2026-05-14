'use client';

import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { EmbeddedProduct } from '@/lib/article-types';
import { EmbeddedProductCard } from './EmbeddedProductCard';

interface Props {
  bodyMd: string;
  embeddedProducts: EmbeddedProduct[];
}

/**
 * Renders an article body. The editor inserts `<div data-product="slug">`
 * markers; we intercept those divs and replace them with a shoppable product
 * card. Anything else falls through to plain markdown rendering with GFM.
 */
export function ArticleBody({ bodyMd, embeddedProducts }: Props) {
  const bySlug = new Map(embeddedProducts.map((p) => [p.slug, p]));

  const components: Components = {
    div(props) {
      const { node: _node, ...rest } = props as {
        node?: unknown;
      } & Record<string, unknown>;
      const slug =
        typeof rest['data-product'] === 'string'
          ? (rest['data-product'] as string)
          : undefined;
      if (slug) {
        const product = bySlug.get(slug);
        if (!product) {
          return (
            <div className="not-prose my-6 rounded-md border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Missing product embed: <code>{slug}</code>
            </div>
          );
        }
        return <EmbeddedProductCard product={product} />;
      }
      return <div {...(rest as Record<string, unknown>)} />;
    },
    a({ href, children, ...rest }) {
      const external = href?.startsWith('http');
      return (
        <a
          href={href}
          {...(external && {
            target: '_blank',
            rel: 'noopener noreferrer',
          })}
          {...rest}
        >
          {children}
        </a>
      );
    },
  };

  return (
    <div className="prose prose-neutral max-w-none prose-headings:tracking-tight prose-a:underline-offset-4 prose-img:rounded-xl">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {bodyMd}
      </ReactMarkdown>
    </div>
  );
}
