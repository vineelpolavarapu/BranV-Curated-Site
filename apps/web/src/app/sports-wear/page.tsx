import type { Metadata } from 'next';
import { CategoryCatalog } from '@/components/CategoryCatalog';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sports Wear · BranV',
  description: 'Shop the Sports Wear collection on BranV.',
};

export default async function sports_wearPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  return <CategoryCatalog slug="sports-wear" searchParams={sp} />;
}
