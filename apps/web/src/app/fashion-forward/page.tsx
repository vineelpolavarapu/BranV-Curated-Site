import type { Metadata } from 'next';
import { CategoryCatalog } from '@/components/CategoryCatalog';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Fashion Forward · BranV',
  description: 'Shop the Fashion Forward collection on BranV.',
};

export default async function fashion_forwardPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  return <CategoryCatalog slug="fashion-forward" searchParams={sp} />;
}
