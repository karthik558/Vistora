/** @type {import('next').NextConfig} */
const nextConfig = (phase) => ({
  reactStrictMode: true,
  poweredByHeader: false,
  // Isolate dev artifacts from production builds; previews may use their own cache.
  distDir: process.env.VISTORA_BUILD_DIR || (phase === "phase-development-server" ? ".next-dev" : ".next"),
});

export default nextConfig;
