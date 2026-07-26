import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Inter } from 'next/font/google';
import './globals.css';
import '../styles/design-tokens.css';
import '../styles/motion-tokens.css';
import '../styles/motion-utilities.css';
import '../styles/lenis.css';
import { LenisProvider } from '@/components/motion/lenis-provider';
import { MotionProvider } from '@/components/motion/motion-provider';
import { PageTransitionShell } from '@/components/motion/page-transition-shell';

// Prototype typography: Plus Jakarta Sans for Headings, Inter for Body UI
const fontDisplay = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});
const fontBody = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'BranV — Curated Men\'s Fashion',
  description:
    'Curated men\'s fashion from the retailers you trust. Styled on AI avatars. One click to buy.',
  icons: {
    icon: '/hero/logo.png',
    apple: '/hero/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fontDisplay.variable} ${fontBody.variable}`} suppressHydrationWarning>
      <body className="font-sans" suppressHydrationWarning>
        <LenisProvider>
          <MotionProvider>
            <PageTransitionShell>{children}</PageTransitionShell>
          </MotionProvider>
        </LenisProvider>
      </body>
    </html>
  );
}
