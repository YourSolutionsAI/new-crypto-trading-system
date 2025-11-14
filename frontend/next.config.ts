import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deaktiviere Turbopack für bessere Kompatibilität mit PostCSS
  experimental: {
    turbo: false,
  },
  // WICHTIG: 'standalone' entfernt - nicht kompatibel mit Vercel Serverless Functions
  // Vercel verwendet automatisch Serverless Functions für Next.js
  // Environment Variables werden automatisch von Vercel gesetzt
};

export default nextConfig;
