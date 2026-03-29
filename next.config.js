/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Don't attempt to statically render API routes at build time
  output: 'standalone',
  experimental: {
    esmExternals: true,
  },
  headers: async () => [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Content-Type', value: 'application/json' },
      ],
    },
  ],
};

module.exports = nextConfig;
