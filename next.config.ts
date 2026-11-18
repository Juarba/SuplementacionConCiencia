import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firma digital para ARCA: se usa tal cual desde node_modules, sin empaquetar
  serverExternalPackages: ["node-forge"],
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
