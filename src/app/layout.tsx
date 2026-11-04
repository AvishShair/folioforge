import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import "./globals.css";
const site = process.env.NEXT_PUBLIC_SITE_URL;
export const metadata: Metadata = {
  metadataBase: site ? new URL(site) : undefined,
  title: {
    default: "FolioForge | Your files. In good hands.",
    template: "%s | FolioForge",
  },
  description:
    "Private PDF and image tools that work directly in your browser.",
  openGraph: {
    title: "FolioForge",
    description: "A better workspace for your PDFs and images.",
    type: "website",
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <Header />
        {children}
        <footer>
          <Link className="brand" href="/">
            FolioForge
          </Link>
          <p>Made for your files. Built for your privacy.</p>
          <a href="https://github.com/AvishShair/folioforge">
            Source on GitHub ↗
          </a>
        </footer>
      </body>
    </html>
  );
}
