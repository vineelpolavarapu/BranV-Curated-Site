#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   BranV theme-migration audit (THEME_REDESIGN_PLAN §3.4 + §9.0).

   Enforces the "Confident Blue" reskin coverage guarantee:
     • Fails (in --strict) when legacy black/white color literals remain.
     • Reports raw hex literals and per-file counts so migration can be tracked
       to zero across every page, sub-page and section.

   Usage:
     node scripts/theme-audit.mjs            # report only (exit 0)
     node scripts/theme-audit.mjs --strict   # exit 1 if any literal remains (CI)

   This is a grep-style guard implemented as a zero-dependency script because the
   project currently has no ESLint config file; a formal `no-restricted-syntax`
   rule can be layered on later without changing this contract.
   ───────────────────────────────────────────────────────────────────────── */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');

// Legacy black/white theme literals that must be migrated to semantic tokens.
const PATTERNS = [
  { label: 'bg-black', re: /\bbg-black\b/g },
  { label: 'text-white', re: /\btext-white\b/g },
  { label: 'bg-white', re: /\bbg-white\b/g },
  { label: 'text-black', re: /\btext-black\b/g },
  { label: 'border-black', re: /\bborder-black\b/g },
  { label: 'bg-ink', re: /\bbg-ink\b/g },
  { label: 'text-ink', re: /\btext-ink\b/g },
  { label: 'hex #000', re: /#000(?![0-9a-fA-F])|#000000\b/g },
  { label: 'hex #fff', re: /#fff(?![0-9a-fA-F])|#ffffff\b/gi },
];

const EXTS = new Set(['.tsx', '.ts', '.jsx', '.js', '.css']);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (EXTS.has(extname(full))) files.push(full);
  }
  return files;
}

const files = walk(SRC);
const perFile = [];
const totals = Object.fromEntries(PATTERNS.map((p) => [p.label, 0]));
let grand = 0;

for (const file of files) {
  // Skip the token + audit infrastructure itself.
  if (/design-tokens\.css$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  let fileCount = 0;
  const hits = [];
  for (const { label, re } of PATTERNS) {
    const m = text.match(re);
    if (m) {
      fileCount += m.length;
      totals[label] += m.length;
      hits.push(`${label}×${m.length}`);
    }
  }
  if (fileCount > 0) {
    perFile.push({ file: relative(join(__dirname, '..'), file), fileCount, hits });
    grand += fileCount;
  }
}

perFile.sort((a, b) => b.fileCount - a.fileCount);

console.log('\nBranV theme-audit — legacy color literals remaining\n' + '='.repeat(52));
for (const { file, fileCount, hits } of perFile) {
  console.log(`  ${String(fileCount).padStart(4)}  ${file}  (${hits.join(', ')})`);
}
console.log('-'.repeat(52));
console.log('  By pattern:');
for (const [label, n] of Object.entries(totals)) {
  if (n) console.log(`    ${String(n).padStart(4)}  ${label}`);
}
console.log('-'.repeat(52));
console.log(`  Files with literals: ${perFile.length}`);
console.log(`  Total literals:      ${grand}`);
console.log(`  Progress target:     0 (every page/section migrated — §9.0)\n`);

const strict = process.argv.includes('--strict');
if (strict && grand > 0) {
  console.error(`FAIL (--strict): ${grand} legacy color literal(s) remain.`);
  process.exit(1);
}
