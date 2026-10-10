import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is intentionally off: see DECISIONS.md.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
