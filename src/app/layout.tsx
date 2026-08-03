import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteFooter, SiteHeader } from "@/components/layout/site-chrome";

export const metadata: Metadata = {
  title: {
    default: "Cyber Alert DRC - Vérifiez avant de faire confiance",
    template: "%s | Cyber Alert DRC",
  },
  description:
    "Vérifiez un lien avant de cliquer. Signalement, scans développeurs et audits pour la RDC.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3010"),
};

export const viewport: Viewport = {
  themeColor: "#0e6b8a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <SiteHeader />
        <main className="min-h-[70vh]">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
