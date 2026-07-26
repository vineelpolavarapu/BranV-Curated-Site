'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  ReviewPublic,
  Reviewability,
  ReviewsPage,
} from '@/lib/phase8-types';

interface Props {
  productId: string;
  avgRating: number | null;
  reviewCount: number;
}

export function ReviewsSection({ productId, avgRating, reviewCount }: Props) {
  const [page, setPage] = useState<ReviewsPage | null>(null);
  const [reviewability, setReviewability] = useState<Reviewability | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [list, mine] = await Promise.all([
      apiFetch<ReviewsPage>(`/products/${productId}/reviews?pageSize=20`),
      apiFetch<Reviewability>(`/products/${productId}/reviews/me`),
    ]);
    if (list.ok && list.data) setPage(list.data);
    // 401/403 → not signed in or not a member. Show "sign in to review" hint.
    if (mine.ok && mine.data) {
      setReviewability(mine.data);
    } else {
      setReviewability(null);
    }
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="mx-auto max-w-7xl px-6 pb-12 pt-2">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Reviews</h2>
          <p className="mt-1 text-sm text-content-soft">
            {reviewCount > 0
              ? `★ ${avgRating?.toFixed(2) ?? '—'} · ${reviewCount} review${reviewCount === 1 ? '' : 's'}`
              : 'No reviews yet.'}
          </p>
        </div>
      </header>

      {reviewability?.canReview ? (
        <ReviewForm productId={productId} onSubmitted={load} />
      ) : reviewability?.ownReview ? (
        <p className="mb-6 rounded-md bg-emerald-50 px-4 py-3 text-sm text-success">
          ✓ You&apos;ve reviewed this. Yours appears below.
        </p>
      ) : reviewability ? (
        <p className="mb-6 rounded-md bg-surface-muted px-4 py-3 text-sm text-content-soft">
          Reviews are open to members who&apos;ve bought this product.{' '}
          <span className="text-xs text-content-muted">
            (Click Buy Now → confirm "Yes I bought it" on return to unlock.)
          </span>
        </p>
      ) : (
        <p className="mb-6 rounded-md bg-surface-muted px-4 py-3 text-sm text-content-soft">
          <Link href="/login" className="font-medium underline">
            Sign in
          </Link>{' '}
          to leave a review.
        </p>
      )}

      {loading ? (
        <div className="h-2 w-32 animate-pulse rounded bg-line" />
      ) : !page || page.data.length === 0 ? (
        <p className="text-sm text-content-soft">Be the first to review.</p>
      ) : (
        <ul className="space-y-5">
          {page.data.map((r) => (
            <li key={r.id}>
              <ReviewItem review={r} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReviewItem({ review }: { review: ReviewPublic }) {
  return (
    <article className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-2 flex items-center justify-between">
        <Stars value={review.rating} />
        <p className="text-xs text-content-soft">
          {review.author.displayName} ·{' '}
          {new Date(review.createdAt).toLocaleDateString()}
        </p>
      </div>
      {review.title && (
        <p className="text-base font-medium">{review.title}</p>
      )}
      {review.body && (
        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-content-soft">
          {review.body}
        </p>
      )}
    </article>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span aria-label={`${value} out of 5`} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <path
            d="M7 1.5l1.7 3.6 4 .5-2.9 2.8.7 4-3.5-1.9-3.5 1.9.7-4L1.3 5.6l4-.5L7 1.5z"
            fill={n <= value ? '#f59e0b' : 'none'}
            stroke={n <= value ? '#f59e0b' : '#d4d4d4'}
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

function ReviewForm({
  productId,
  onSubmitted,
}: {
  productId: string;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await apiFetch(`/products/${productId}/reviews`, {
      method: 'POST',
      body: JSON.stringify({
        rating,
        title: title || undefined,
        body: body || undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not submit');
      return;
    }
    setTitle('');
    setBody('');
    setRating(5);
    onSubmitted();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-6 rounded-xl border border-line bg-surface p-5"
    >
      <p className="text-sm font-medium">Leave a review</p>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-content-soft">
          Rating
        </span>
        <span className="inline-flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              className="text-amber-500"
            >
              <svg width="22" height="22" viewBox="0 0 14 14" aria-hidden>
                <path
                  d="M7 1.5l1.7 3.6 4 .5-2.9 2.8.7 4-3.5-1.9-3.5 1.9.7-4L1.3 5.6l4-.5L7 1.5z"
                  fill={n <= rating ? '#f59e0b' : 'none'}
                  stroke={n <= rating ? '#f59e0b' : '#d4d4d4'}
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
        </span>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="mt-3 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share your experience…"
        rows={4}
        className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit review'}
        </button>
      </div>
    </form>
  );
}
