"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { SafefindLostPanel } from "@/components/safefind/SafefindLostPanel";
import { SafefindFoundPanel } from "@/components/safefind/SafefindFoundPanel";

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5 4.5 7v5.2c0 4.4 3.2 7.6 7.5 8.8 4.3-1.2 7.5-4.4 7.5-8.8V7L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 12.2 11 14.7l4.5-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type SafefindRoleMode = "lost" | "found";

function parseMode(raw: string | null): SafefindRoleMode {
  return raw === "found" || raw === "retrouve" ? "found" : "lost";
}

function parseLostTab(raw: string | null): "declare" | "search" {
  return raw === "search" || raw === "id" ? "search" : "declare";
}

export function SafefindHome() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const mode = useMemo(() => parseMode(searchParams.get("mode")), [searchParams]);
  const lostTab = useMemo(() => parseLostTab(searchParams.get("tab")), [searchParams]);

  const setMode = useCallback(
    (next: SafefindRoleMode) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("mode", next);
      if (next === "found") q.delete("tab");
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-lg px-4 pb-16 pt-8">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mb-6"
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--ca-accent)]/15 text-[var(--ca-accent)] ring-1 ring-[var(--ca-accent)]/30">
            <IconShield className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs tracking-[0.2em] text-[var(--ca-ink-muted)] uppercase">
              Cyber Alert RDC
            </p>
            <h1 className="font-sans text-3xl font-semibold tracking-tight text-[var(--ca-ink)]">
              SafeFind
            </h1>
          </div>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-[var(--ca-ink-muted)]">
          Carte d’électeur, passeport ou permis — restitution via un Point SafeFind, sans
          rencontre trouveur / propriétaire.
        </p>
      </motion.header>

      <div
        className="mb-6 flex rounded-2xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)]/80 p-1.5 backdrop-blur"
        role="tablist"
        aria-label="Votre rôle"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "lost"}
          onClick={() => setMode("lost")}
          className={`relative flex-1 rounded-xl py-3 text-sm font-semibold transition ${
            mode === "lost"
              ? "bg-amber-500/90 text-white shadow-sm"
              : "text-[var(--ca-ink-muted)] hover:text-[var(--ca-ink)]"
          }`}
        >
          J’ai perdu
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "found"}
          onClick={() => setMode("found")}
          className={`relative flex-1 rounded-xl py-3 text-sm font-semibold transition ${
            mode === "found"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-[var(--ca-ink-muted)] hover:text-[var(--ca-ink)]"
          }`}
        >
          J’ai retrouvé
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.28 }}
        >
          {mode === "lost" ? (
            <SafefindLostPanel initialTab={lostTab} showHeading={false} />
          ) : (
            <SafefindFoundPanel showHeading={false} />
          )}
        </motion.div>
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="mt-10 flex flex-col items-center gap-3 text-center text-xs text-[var(--ca-ink-muted)]"
      >
        <Link
          href="/safefind/partners"
          className="underline-offset-4 hover:text-[var(--ca-ink)] hover:underline"
        >
          Points SafeFind près de moi
        </Link>
        <Link
          href="/safefind/partner"
          className="underline-offset-4 hover:text-[var(--ca-ink)] hover:underline"
        >
          Espace partenaire
        </Link>
      </motion.div>
    </div>
  );
}
