import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.3.107"],
  serverExternalPackages: ["@prisma/client", "bcryptjs", "@auth/prisma-adapter"],
};

export default nextConfig;
