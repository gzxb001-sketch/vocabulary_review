import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/adapter-libsql", "@libsql/client", "tesseract.js"],
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
