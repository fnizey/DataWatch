/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['xlsx', 'papaparse'],
  },
};

module.exports = nextConfig;
