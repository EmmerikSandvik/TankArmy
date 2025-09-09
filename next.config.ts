import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "jzujhjrnoydgfyxxddml.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // alternativt: domains: ["jzujhjrnoydgfyxxddml.supabase.co"],
  },
};

export default nextConfig;
