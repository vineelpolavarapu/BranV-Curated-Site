// Temporary diagnostic endpoint — remove after confirming production env vars.
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? null,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? null,
  });
}
