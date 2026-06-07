import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
