import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-chrome";
import { getSessionUser } from "@/lib/auth/session";
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";
import { PwaInstallBanner } from "@/components/pwa/install-banner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "SafeFind - Cyber Alert RDC",
    template: "%s | Cyber Alert DRC",
  },
  description:
    "Carte d'électeur, passeport ou permis - retrouver et restituer via un Point SafeFind.",
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
        <main className="min-h-[100dvh]">{children}</main>
        <RegisterServiceWorker />
        <PwaInstallBanner />
      </body>
    </html>
  );
}
