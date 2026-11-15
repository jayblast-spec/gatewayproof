import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://jayblast-spec.github.io/gatewayproof/";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "gatewayproof docs",
  description:
    "Conformance tests for OpenAI-compatible LLM gateways: streaming fidelity, usage, cost, concurrency, and error propagation against a deterministic mock upstream.",
  alternates: { canonical: siteUrl },
  openGraph: {
    title: "gatewayproof docs",
    description:
      "Conformance tests for OpenAI-compatible LLM gateways against a deterministic mock upstream.",
    url: siteUrl,
    images: [{ url: "/banner.png", width: 1200, height: 630 }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
