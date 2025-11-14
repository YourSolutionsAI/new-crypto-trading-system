import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  
  // Environment Variables werden automatisch von Vercel geladen
  // NEXT_PUBLIC_* Variablen sind automatisch verfügbar
};

export default nextConfig;
