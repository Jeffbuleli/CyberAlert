import type { MetadataRoute } from "next";

const ORIGIN = (
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://cyberalert-rdc.org"
).replace(/\/$/, "");

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${ORIGIN}/`,
    name: "Cyber Alert DRC",
    short_name: "Cyber Alert",
    description:
      "Vérifiez un lien avant de cliquer. Signalement et scans pour la RDC.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "browser"],
    background_color: "#ffffff",
    theme_color: "#1f4fd8",
    orientation: "any",
    lang: "fr",
    dir: "ltr",
    categories: ["security", "utilities"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
