import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Toutes les pages de l'application dépendent de l'utilisateur connecté :
  // on reste sur le rendu dynamique classique (plus simple et prévisible).
  cacheComponents: false,
  experimental: {
    // Réseau instable sur chantier : navigations et enregistrements en attente
    // sont rejoués automatiquement au retour du réseau.
    useOffline: true,
    // Photos et PDF des grilles fournisseurs (réduits dans le navigateur ; 4 Mo au total).
    serverActions: { bodySizeLimit: "5mb" },
  },
  // PGlite (base de développement) ne doit pas être empaqueté.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
