import type { NextConfig } from "next";

const configuredBackend =
  process.env.BACKEND_URL ||
  process.env.INTERNAL_API_URL ||
  (process.env.NEXT_PUBLIC_API_URL?.startsWith("http")
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://127.0.0.1:8000");

const backendOrigin = configuredBackend
  .replace(/\/api\/?$/, "")
  .replace(/\/+$/, "")
  .replace("://localhost:", "://127.0.0.1:");

const nextConfig: NextConfig = {
  compress: false,
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
