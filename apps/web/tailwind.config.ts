import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

// Breakpoint semantics:
//   base          → phone (0–639px)
//   sm: 640px     → large phone / phablet
//   md: 768px     → tablet  (tablet-specific tweaks only)
//   lg: 1024px    → desktop (primary layout split point)
//   xl: 1280px    → wide desktop
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      colors: {
        ink: {
          DEFAULT: '#0a0a0a',
          soft: '#1a1a1a',
        },
      },
    },
  },
  plugins: [typography],
};

export default config;
