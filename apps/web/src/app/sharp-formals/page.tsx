import type { Metadata } from 'next';
import { CategoryCatalog } from '@/components/CategoryCatalog';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sharp Formals · BranV',
  description: 'Shop the Sharp Formals collection on BranV.',
};

export default async function sharp_formalsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  return <CategoryCatalog slug="sharp-formals" searchParams={sp} />;
}
