import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    config.resolve.alias = {
      ...config.resolve.alias,
      "@/ee": path.resolve(__dirname, "lib/ee-fallback.ts"),
    };
    return config;
  },
};

export default nextConfig;