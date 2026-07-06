import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

// Breakpoint semantics:
//   base          → phone (0–639px)
//   sm: 640px     → large phone / phablet
//   md: 768px     → tablet  (tablet-specific tweaks only)
//   lg: 1080px    → desktop (primary layout split point — covers all handheld below desktop)
//   xl: 1280px    → wide desktop
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      screens: {
        lg: '1080px',
      },
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
