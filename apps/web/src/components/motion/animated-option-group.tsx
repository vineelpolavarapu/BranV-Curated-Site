'use client';

import { ReactNode } from 'react';

interface Option<T> {
  value: T;
  label: ReactNode;
}

interface AnimatedOptionGroupProps<T> {
  options: Option<T>[];
  activeValue: T;
  onChange: (value: T) => void;
  className?: string;
}

export function AnimatedOptionGroup<T extends string | number>({
  options,
  activeValue,
  onChange,
  className = '',
}: AnimatedOptionGroupProps<T>) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((opt) => {
        const isActive = opt.value === activeValue;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`relative rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ease-out-back ${
              isActive
                ? 'bg-primary text-primary-fg scale-[1.04] shadow-sm'
                : 'bg-surface-muted text-content-soft hover:bg-line hover:text-content hover:scale-[1.02]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
