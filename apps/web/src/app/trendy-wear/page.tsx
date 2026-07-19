import type { Metadata } from 'next';
import { CategoryCatalog } from '@/components/CategoryCatalog';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Trendy Wear · BranV',
  description: 'Shop the Trendy Wear collection on BranV.',
};

export default async function trendy_wearPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  return <CategoryCatalog slug="trendy-wear" searchParams={sp} />;
}
