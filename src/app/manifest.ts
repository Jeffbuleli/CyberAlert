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
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#e9eef5",
    theme_color: "#1f4fd8",
    orientation: "any",
    lang: "fr",
    categories: ["security", "utilities"],
    icons: [
      {
        src: "/icons/icon-144.png",
        sizes: "144x144",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-256.png",
        sizes: "256x256",
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
