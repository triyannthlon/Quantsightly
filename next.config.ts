import type { NextConfig } from "next";

const nextConfig: NextConfig =
                             {
                             output: "standalone",
                             experimental: {turbopackFileSystemCacheForDev: true,},
                             devIndicators: false,
                             allowedDevOrigins: [ "http://localhost", "http://192.168.1.44", ],

                             async rewrites()
                                  {
                                  return [{
                                          source: "/qs-api/:path*",
                                          destination: `${process.env.QS_BACKEND_URL}/:path*`,},];
                                  },

                             images: {
                                     remotePatterns: [{
                                                      protocol: "https",
                                                      hostname: "eodhd.com",
                                                      pathname: "/img/logos/**",
                                                      },],
                                     },

                             };

export default nextConfig;
