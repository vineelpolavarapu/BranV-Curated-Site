/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Admin UI displays retailer-sourced images from arbitrary hosts (Flipkart,
    // Amazon, Myntra, etc.) plus AI uploads on our own R2/MinIO bucket. We
    // render most admin images with `unoptimized` so the URL just passes through;
    // these patterns are kept narrow for storefront usage in later phases.
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'https', hostname: '**.cloudflare.com' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  transpilePackages: ['@branv/shared'],
};

export default nextConfig;
