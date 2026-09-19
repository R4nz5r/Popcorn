import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.0.116",
    "192.168.0.116:3000",
    "localhost:3000",
    "*.loca.lt",
  ],
};

export default nextConfig;
