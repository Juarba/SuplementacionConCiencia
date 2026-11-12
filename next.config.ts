import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sistema interno: todas las páginas se generan en cada visita (datos siempre actualizados)
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
