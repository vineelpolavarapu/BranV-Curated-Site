#!/usr/bin/env node
/* One-shot theme codemod (THEME_REDESIGN_PLAN §3.4).
   Applies the unambiguous, value-preserving legacy→semantic-token class swaps
   across src. Order matters: compound (hover:/group-hover:/focus:) prefixes are
   handled before their bare forms so they don't get double-rewritten.

   white/black → primary-fg/surface/content are exact value preserves.
   neutral-* grays → content/line/surface tokens (tiny, intentional palette shift).
   bg-neutral-900 → bg-primary: in this storefront that class is used for primary
   CTAs, which the "Confident Blue" reference renders in blue.

   Run once:  node scripts/theme-codemod.mjs
   Review the git diff afterwards. */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');

// Ordered — earlier entries run first.
const RULES = [
  // compound state prefixes first
  ['hover:text-neutral-950', 'hover:text-primary'],
  ['hover:text-neutral-900', 'hover:text-primary'],
  ['group-hover:text-neutral-900', 'group-hover:text-primary'],
  ['group-hover:text-white', 'group-hover:text-primary-fg'],
  ['group-hover:bg-neutral-900', 'group-hover:bg-primary'],
  ['hover:border-neutral-400', 'hover:border-primary/40'],
  ['hover:border-neutral-300', 'hover:border-primary/40'],
  ['hover:bg-neutral-800', 'hover:bg-primary-hover'],
  ['hover:bg-neutral-100', 'hover:bg-surface-muted'],
  ['hover:bg-neutral-50', 'hover:bg-surface-muted'],
  ['focus:border-neutral-900', 'focus:border-primary'],
  ['focus:ring-neutral-900', 'focus:ring-primary'],
  // solids / CTAs
  ['bg-neutral-950', 'bg-primary'],
  ['bg-neutral-900', 'bg-primary'],
  ['bg-neutral-800', 'bg-primary-hover'],
  // text ramp
  ['text-neutral-950', 'text-content'],
  ['text-neutral-900', 'text-content'],
  ['text-neutral-800', 'text-content'],
  ['text-neutral-700', 'text-content-soft'],
  ['text-neutral-600', 'text-content-soft'],
  ['text-neutral-500', 'text-content-soft'],
  ['text-neutral-400', 'text-content-muted'],
  ['text-neutral-300', 'text-content-muted'],
  // surfaces / lines
  ['bg-neutral-50', 'bg-surface-muted'],
  ['bg-neutral-100', 'bg-surface-muted'],
  ['bg-neutral-200', 'bg-line'],
  ['border-neutral-200', 'border-line'],
  ['border-neutral-300', 'border-line'],
  ['border-neutral-400', 'border-line'],
  ['divide-neutral-200', 'divide-line'],
  ['divide-neutral-100', 'divide-line'],
  // black / white (exact value preserves)
  ['bg-black/', 'bg-content/'],
  ['text-white', 'text-primary-fg'],
  ['bg-white', 'bg-surface'],
  // semantic status colors
  ['text-emerald-800', 'text-success'],
  ['text-emerald-700', 'text-success'],
  ['text-red-600', 'text-danger'],
];

const EXTS = new Set(['.tsx', '.ts']);
// Files that own intentional non-token values — skip.
const SKIP = new Set(['design-tokens.css']);
// Admin surfaces are handled deliberately in P6 (utilitarian, not auto-blued).
const SKIP_PATH = /[\\/](admin|AdminShell|QuickAddModal|BrandFormModal|ProductPicker|MultiProductPicker|ArticleEditor|EditEditor|LookbookEditor|MiniBarChart)/i;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (EXTS.has(extname(full))) files.push(full);
  }
  return files;
}

let changed = 0;
for (const file of walk(SRC)) {
  if (SKIP.has(file.split(/[\\/]/).pop())) continue;
  // P6: admin now included (light shell — blue primaries are on-theme). Keep
  // SKIP_PATH available but disabled so the sweep reaches every surface.
  void SKIP_PATH;
  let text = readFileSync(file, 'utf8');
  const before = text;
  for (const [from, to] of RULES) text = text.split(from).join(to);
  if (text !== before) {
    writeFileSync(file, text);
    changed++;
    console.log('  updated', file.replace(join(__dirname, '..'), '.'));
  }
}
console.log(`\nCodemod complete: ${changed} file(s) updated.`);
