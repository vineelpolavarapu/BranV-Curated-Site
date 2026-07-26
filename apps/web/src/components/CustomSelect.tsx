'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';

export interface CustomSelectOption {
  value: string;
  label: string;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  className?: string;
  ariaLabel?: string;
}

export function CustomSelect({
  value,
  onChange,
  options,
  className = '',
  ariaLabel,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-left text-sm hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <span className="truncate">{current?.label ?? ''}</span>
        <Icon.ChevronDown
          aria-hidden
          size={14}
          strokeWidth={1.75}
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-1 max-h-72 min-w-full overflow-auto rounded-md border border-line bg-surface py-1 shadow-lg"
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`cursor-pointer whitespace-nowrap px-3 py-1.5 text-sm transition-colors ${
                  selected
                    ? 'bg-primary text-primary-fg'
                    : 'text-content hover:bg-surface-muted'
                }`}
              >
                {o.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
