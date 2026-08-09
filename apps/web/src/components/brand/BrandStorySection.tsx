'use client';

import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BrandStoryPublic } from '@/lib/phase7-types';

/**
 * Renders a brand story safely. We deliberately do NOT include `rehype-raw`
 * here - that means any inline HTML in the markdown is stripped by react-
 * markdown's default sanitizing pipeline, so even an admin pasting `<script>`
 * into the body can't inject anything onto the public brand page.
 */
export function BrandStorySection({ story }: { story: BrandStoryPublic }) {
  if (!story.bodyMd.trim()) return null;
  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.18em] text-content-soft">
        Brand story
      </p>
      {story.heroUrl && (
        <div className="relative mb-6 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-surface-muted">
          <Image
            src={story.heroUrl}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 1023px) 100vw, 768px"
            className="object-cover"
          />
        </div>
      )}
      <div className="prose prose-neutral max-w-none prose-headings:tracking-tight">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {story.bodyMd}
        </ReactMarkdown>
      </div>
    </section>
  );
}
