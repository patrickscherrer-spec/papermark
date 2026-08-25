/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: [
      "localhost",
      "papermark.io",
      "papermark.s3.eu-central-1.amazonaws.com",
    ],
  },
  async redirects() {
    return [];
  },
  webpack: (config) => {
    // Leitet fehlende Enterprise/EE-Importe automatisch auf leere Fallbacks um
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
};

export default nextConfig;