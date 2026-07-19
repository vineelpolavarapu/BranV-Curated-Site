import type { Metadata } from 'next';
import { CategoryCatalog } from '@/components/CategoryCatalog';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Classic Essentials · BranV',
  description: 'Shop the Classic Essentials collection on BranV.',
};

export default async function classic_essentialsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  return <CategoryCatalog slug="classic-essentials" searchParams={sp} />;
}
