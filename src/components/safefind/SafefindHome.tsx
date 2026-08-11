"use client";

import Link from "next/link";
import { motion } from "framer-motion";

function IconLost({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 8h8M8 12h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="17" cy="17" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M19.2 19.2 21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 16l4.2 4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconFound({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5 4.5 7v5.2c0 4.4 3.2 7.6 7.5 8.8 4.3-1.2 7.5-4.4 7.5-8.8V7L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8.5 12.2 11 14.7l4.5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPin({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="11" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

const ACTIONS = [
  {
    href: "/safefind/lost",
    label: "J’ai perdu",
    hint: "Déclarer une pièce",
    Icon: IconLost,
    tone: "from-amber-500/20 to-transparent",
  },
  {
    href: "/safefind/search",
    label: "Je recherche",
    hint: "Retrouver ma pièce",
    Icon: IconSearch,
    tone: "from-sky-500/20 to-transparent",
  },
  {
    href: "/safefind/found",
    label: "J’ai trouvé",
    hint: "Déposer en sécurité",
    Icon: IconFound,
    tone: "from-emerald-500/25 to-transparent",
  },
  {
    href: "/safefind/partners",
    label: "Points SafeFind",
    hint: "Proche de moi",
    Icon: IconPin,
    tone: "from-stone-400/20 to-transparent",
  },
] as const;

export function SafefindHome() {
  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-lg px-4 pb-16 pt-8">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mb-8"
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--ca-accent)]/15 text-[var(--ca-accent)] ring-1 ring-[var(--ca-accent)]/30">
            <IconFound className="h-7 w-7" />
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
          Retrouver · Vérifier · Restituer — via un Point SafeFind, sans rencontre trouveur /
          propriétaire.
        </p>
      </motion.header>

      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map((a, i) => (
          <motion.div
            key={a.href}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i, duration: 0.4 }}
          >
            <Link
              href={a.href}
              className={`group relative flex min-h-[132px] flex-col justify-between overflow-hidden rounded-2xl border border-[var(--ca-border)] bg-[var(--ca-surface-raised)]/80 p-4 backdrop-blur transition hover:border-[var(--ca-accent)]/40 hover:bg-[var(--ca-surface-2)]`}
            >
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${a.tone} opacity-80`}
              />
              <a.Icon className="relative h-8 w-8 text-[var(--ca-accent)] transition group-hover:scale-105" />
              <div className="relative">
                <p className="text-base font-semibold text-[var(--ca-ink)]">{a.label}</p>
                <p className="mt-0.5 text-xs text-[var(--ca-ink-muted)]">{a.hint}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-center text-xs text-[var(--ca-ink-muted)]"
      >
        <Link href="/safefind/partner" className="underline-offset-4 hover:underline">
          Espace partenaire
        </Link>
      </motion.p>
    </div>
  );
}
