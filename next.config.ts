import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // The Admin Panel only renders dynamic external images (ImgBB / Pexels /
    // blob previews) and local brand assets inside fixed-size UI boxes.
    // Unoptimized mode renders a plain <img>, which is exactly what these
    // use cases need — no domain allow-lists, no resize pipeline.
    unoptimized: true,
  },
};

export default nextConfig;
