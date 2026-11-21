import type { NextConfig } from "next";

/**
 * Con GITHUB_PAGES=true il sito viene esportato come file statici (cartella `out/`)
 * con il prefisso del repository, pronto per https://<utente>.github.io/anniversario/.
 * In locale (`npm run dev` / `npm run start`) resta una normale app Next.js.
 */
const pages = process.env.GITHUB_PAGES === "true";
const basePath = pages ? process.env.PAGES_BASE_PATH ?? "/anniversario" : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["three"],
  ...(pages ? { output: "export", basePath, trailingSlash: true, images: { unoptimized: true } } : {}),
};

export default nextConfig;
