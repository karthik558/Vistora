/** @type {import('next').NextConfig} */
const nextConfig = (phase) => ({
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "@tanstack/react-query"],
  },
  // Automatically map standard SUPABASE_URL and SUPABASE_ANON_KEY to NEXT_PUBLIC_ client variables
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      "",
  },
  // Isolate dev artifacts from production builds; previews may use their own cache.
  distDir: process.env.VISTORA_BUILD_DIR || (phase === "phase-development-server" ? ".next-dev" : ".next"),
});

export default nextConfig;
