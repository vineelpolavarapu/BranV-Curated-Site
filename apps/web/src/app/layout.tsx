import type { Metadata, Viewport } from 'next';
import './globals.css';
import '../styles/motion-tokens.css';
import '../styles/motion-utilities.css';
import '../styles/lenis.css';
import { LenisProvider } from '@/components/motion/lenis-provider';
import { PageTransitionShell } from '@/components/motion/page-transition-shell';

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
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans" suppressHydrationWarning>
        <LenisProvider>
          <PageTransitionShell>{children}</PageTransitionShell>
        </LenisProvider>
      </body>
    </html>
  );
}
