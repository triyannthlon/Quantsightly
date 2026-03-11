import type { NextConfig } from "next";

const nextConfig: NextConfig =
                             {
                             output: "standalone",
                             experimental: {turbopackFileSystemCacheForDev: true,},
                             devIndicators: false,
                             allowedDevOrigins: [ "http://localhost", "http://192.168.1.44", ],
                             };

export default nextConfig;
