import type { Metadata } from 'next';
import { CategoryCatalog } from '@/components/CategoryCatalog';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sweatshirts · BranV',
  description: 'Shop the Sweatshirts collection on BranV.',
};

export default async function SweatshirtsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  return <CategoryCatalog slug="sweatshirts" searchParams={sp} />;
}