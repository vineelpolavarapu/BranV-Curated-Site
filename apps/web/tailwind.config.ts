import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

// Breakpoint semantics:
//   base          → phone (0–639px)
//   sm: 640px     → large phone / phablet
//   md: 768px     → tablet  (tablet-specific tweaks only)
//   lg: 1080px    → desktop (primary layout split point - covers all handheld below desktop)
//   xl: 1280px    → wide desktop
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      screens: {
        lg: '1080px',
      },
      fontFamily: {
        // Body/UI = Inter (via next/font var, §5); display = Poppins for headings.
        sans: ['var(--font-body)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-body)', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      colors: {
        // Legacy black/white theme token - left intact so existing `text-ink`/
        // `bg-ink` usages render identically until migrated per THEME_REDESIGN_PLAN §9.
        ink: {
          DEFAULT: '#0a0a0a',
          soft: '#1a1a1a',
        },
        // ── New "Confident Blue" semantic tokens (design-tokens.css §4) ──────
        // Additive only: introduces new utilities, changes no existing output.
        // rgb(var / <alpha-value>) enables opacity modifiers (e.g. bg-surface/95).
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          muted: 'rgb(var(--color-surface-muted) / <alpha-value>)',
        },
        content: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          soft: 'rgb(var(--color-ink-soft) / <alpha-value>)',
          muted: 'rgb(var(--color-ink-muted) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          hover: 'rgb(var(--color-primary-hover) / <alpha-value>)',
          fg: 'rgb(var(--color-on-primary) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          fg: 'rgb(var(--color-on-accent) / <alpha-value>)',
        },
        rating: 'rgb(var(--color-rating) / <alpha-value>)',
        sale: 'rgb(var(--color-sale) / <alpha-value>)',
        line: 'rgb(var(--color-border) / <alpha-value>)',
        ring: 'rgb(var(--color-ring) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
      },
      borderRadius: {
        card: 'var(--radius-lg)',
      },
      boxShadow: {
        card: 'var(--shadow-sm)',
        'card-hover': 'var(--shadow-md)',
      },
      backgroundImage: {
        'hero-gradient': 'var(--gradient-hero)',
      },
    },
  },
  plugins: [typography],
};

export default config;
