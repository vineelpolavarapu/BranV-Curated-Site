import Link from 'next/link';
import Image from 'next/image';
import { apiServer } from '@/lib/api-server';
import { DropCalendar, DropSummary } from '@/lib/phase7-types';
import { StorefrontShell } from '@/components/StorefrontShell';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Drops · BranV',
  description: 'Upcoming and live drops from the brands BranV carries.',
};

export default async function DropsCalendarPage() {
  const cal = (await apiServer<DropCalendar>('/drops')) ?? {
    live: [],
    scheduled: [],
    ended: [],
  };

  return (
    <StorefrontShell>
      <section className="mx-auto max-w-7xl px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Drops
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Editorial drops curated across the retailers we cover.
        </p>
      </section>

      <Section title="Live now" items={cal.live} live />
      <Section title="Upcoming" items={cal.scheduled} />
      <Section title="Recent" items={cal.ended} muted />
    </StorefrontShell>
  );
}

function Section({
  title,
  items,
  live = false,
  muted = false,
}: {
  title: string;
  items: DropSummary[];
  live?: boolean;
  muted?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-6 pb-10">
      <h2 className="mb-4 text-lg font-semibold tracking-tight">{title}</h2>
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((d) => (
          <li key={d.id}>
            <DropCard drop={d} live={live} muted={muted} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function DropCard({
  drop,
  live,
  muted,
}: {
  drop: DropSummary;
  live: boolean;
  muted: boolean;
}) {
  const launchLabel =
    drop.status === 'SCHEDULED'
      ? `Launches ${new Date(drop.launchAt).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}`
      : drop.status === 'LIVE'
        ? 'Live now'
        : 'Ended';

  return (
    <Link
      href={`/drops/${drop.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:border-neutral-400"
    >
      <div
        className={`relative aspect-[16/10] w-full bg-neutral-100 ${
          muted ? 'opacity-70' : ''
        }`}
      >
        {drop.heroUrl ? (
          <Image
            src={drop.heroUrl}
            alt={drop.name}
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            unoptimized
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300">
            no hero
          </div>
        )}
        {live && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            Live
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="text-base font-semibold leading-snug">{drop.name}</p>
        <p className="mt-1 text-xs text-neutral-500">{launchLabel}</p>
        {drop.description && (
          <p className="mt-2 line-clamp-2 text-sm text-neutral-600">
            {drop.description}
          </p>
        )}
      </div>
    </Link>
  );
}
