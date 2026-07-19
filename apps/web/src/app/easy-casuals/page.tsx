import type { Metadata } from 'next';
import { CategoryCatalog } from '@/components/CategoryCatalog';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Easy Casuals · BranV',
  description: 'Shop the Easy Casuals collection on BranV.',
};

export default async function easy_casualsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  return <CategoryCatalog slug="easy-casuals" searchParams={sp} />;
}
