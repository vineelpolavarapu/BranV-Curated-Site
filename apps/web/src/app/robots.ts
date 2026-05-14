import type { MetadataRoute } from 'next';

const BASE =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.WEB_ORIGIN ??
  'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Per PRD §11.3: keep crawlers off admin, account, and tracking redirects.
        disallow: ['/admin/', '/account/', '/go/'],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
