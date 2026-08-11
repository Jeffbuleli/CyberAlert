import { Suspense } from "react";
import { SafefindHome } from "@/components/safefind/SafefindHome";

export const metadata = {
  title: "SafeFind - Cyber Alert RDC",
  description:
    "Carte d'électeur, passeport ou permis — retrouver et restituer via un Point SafeFind.",
};

export default function SafefindPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto min-h-[100dvh] w-full max-w-lg px-4 pt-8 text-sm text-[var(--ca-ink-muted)]">
          Chargement SafeFind…
        </div>
      }
    >
      <SafefindHome />
    </Suspense>
  );
}
