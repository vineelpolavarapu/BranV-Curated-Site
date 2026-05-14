'use client';

import { useEffect, useState } from 'react';

interface Props {
  /** ISO timestamp to count down to. */
  target: string;
  /** Label that prefixes the timer (e.g. "Launches in"). */
  label?: string;
  /** Called when the target time arrives — useful to trigger a soft refresh. */
  onElapsed?: () => void;
}

export function Countdown({ target, label = 'Launches in', onElapsed }: Props) {
  const [remaining, setRemaining] = useState<number>(() =>
    Math.max(0, new Date(target).getTime() - Date.now()),
  );

  useEffect(() => {
    const id = setInterval(() => {
      const next = Math.max(0, new Date(target).getTime() - Date.now());
      setRemaining(next);
      if (next === 0) {
        clearInterval(id);
        onElapsed?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [target, onElapsed]);

  const { d, h, m, s } = splitMs(remaining);

  return (
    <div className="text-center">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </p>
      <div className="mt-2 flex justify-center gap-3 font-mono text-3xl font-semibold tabular-nums md:text-5xl">
        <Cell value={d} unit="d" />
        <Sep />
        <Cell value={h} unit="h" />
        <Sep />
        <Cell value={m} unit="m" />
        <Sep />
        <Cell value={s} unit="s" />
      </div>
    </div>
  );
}

function Cell({ value, unit }: { value: number; unit: string }) {
  return (
    <div className="flex min-w-[2.5em] flex-col items-center">
      <span aria-live="polite">{String(value).padStart(2, '0')}</span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
        {unit}
      </span>
    </div>
  );
}

function Sep() {
  return <span className="text-neutral-300">:</span>;
}

function splitMs(ms: number): { d: number; h: number; m: number; s: number } {
  const totalSeconds = Math.floor(ms / 1000);
  return {
    d: Math.floor(totalSeconds / 86400),
    h: Math.floor((totalSeconds % 86400) / 3600),
    m: Math.floor((totalSeconds % 3600) / 60),
    s: totalSeconds % 60,
  };
}
