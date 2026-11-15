import path from "node:path";
import { fileURLToPath } from "node:url";
import { assetPrefix, basePath } from "./base-path.mjs";

const siteDir = path.dirname(fileURLToPath(import.meta.url));

function pagesPath(value) {
  if (!value) return "";
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.replace(/\/$/, "");
}

// configure-pages publishes the project path (/gatewayproof). Fall back to the
// same path for local builds and before Pages metadata is available.
const configuredPath = pagesPath(process.env.BASE_PATH);
const sitePath = configuredPath || basePath;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: sitePath,
  assetPrefix: configuredPath || assetPrefix,
  images: { unoptimized: true },
  trailingSlash: true,
  outputFileTracingRoot: siteDir,
};

export default nextConfig;
