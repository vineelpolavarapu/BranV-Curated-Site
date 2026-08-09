// Plain utility - no React, no 'use client'. Safe to import from both
// server and client components.

export function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(n);
}
