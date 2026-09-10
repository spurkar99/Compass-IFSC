/** @type {import('next').NextConfig} */
const nextConfig = {
  // The prototype stores state as JSON files on disk, so pages must never be
  // cached as static HTML — every request re-reads /data.
  experimental: {},
};

export default nextConfig;
