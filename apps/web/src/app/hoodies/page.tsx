import type { Metadata } from 'next';
import { CategoryCatalog } from '@/components/CategoryCatalog';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Hoodies · BranV',
  description: 'Explore the Hoodies collection on BranV.',
};

export default async function HoodiesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  return <CategoryCatalog slug="hoodies" searchParams={sp} />;
}
