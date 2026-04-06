import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  webpack: (config) => {
    // react-pdf/pdfjs-dist тянет canvas как опциональную зависимость,
    // в браузере она не нужна — отключаем чтобы не падал билд
    config.resolve.alias.canvas = false;
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${
          process.env.NEXT_PUBLIC_API_URL || "http://backend:3001"
        }/api/:path*`,
      },
      {
        source: "/static/uploads/:path*",
        destination: `${
          process.env.NEXT_PUBLIC_API_URL || "http://backend:3001"
        }/static/uploads/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "t.me" },
      { protocol: "https", hostname: "**.telegram.org" },
    ],
  },
};

export default nextConfig;