import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteFooter, SiteHeader } from "@/components/layout/site-chrome";
import { getSessionUser } from "@/lib/auth/session";
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";
import { PwaInstallBanner } from "@/components/pwa/install-banner";

export const metadata: Metadata = {
  title: {
    default: "Cyber Alert DRC - Vérifiez avant de faire confiance",
    template: "%s | Cyber Alert DRC",
  },
  description:
    "Vérifiez un lien avant de cliquer. Signalement, scans développeurs et audits pour la RDC.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3010"),
  applicationName: "Cyber Alert DRC",
  appleWebApp: {
    capable: true,
    title: "Cyber Alert",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#1f4fd8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser().catch(() => null);
  const headerUser = user
    ? { name: user.name, email: user.email, role: user.role }
    : null;

  return (
    <html lang="fr">
      <body className="antialiased">
        <SiteHeader user={headerUser} />
        <main className="min-h-[70vh]">{children}</main>
        <SiteFooter />
        <RegisterServiceWorker />
        <PwaInstallBanner />
      </body>
    </html>
  );
}
