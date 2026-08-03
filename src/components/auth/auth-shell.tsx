"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { Badge, MetaChip, Section } from "@/components/ui/primitives";
import { IconLock } from "@/components/icons";

export function AuthShell({
  title,
  subtitle,
  badge = "Compte sécurisé",
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Section className="py-12 sm:py-16">
      <article className="relative mx-auto w-full max-w-md overflow-hidden rounded-[28px] border border-[var(--ca-border)] bg-[#FAFBFE] shadow-[0_24px_64px_-30px_rgba(12,24,48,0.45)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse at top right, color-mix(in srgb, var(--ca-accent) 14%, transparent), transparent 55%)",
          }}
        />
        <div className="relative z-10 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <BrandLogo size={52} priority />
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--ca-accent)]">
                  Cyber Alert DRC
                </p>
                <h1 className="text-xl font-extrabold tracking-tight text-[var(--ca-ink)] sm:text-2xl">
                  {title}
                </h1>
              </div>
            </div>
            <Badge tone="info">{badge}</Badge>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[var(--ca-ink-muted)]">{subtitle}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <MetaChip label="Session httpOnly" />
            <MetaChip label="Mot de passe hashé" />
            <MetaChip label="Rate-limit" />
          </div>
          <div className="mt-6">{children}</div>
          {footer ? <div className="mt-5 text-center text-sm text-[var(--ca-ink-muted)]">{footer}</div> : null}
        </div>
        <div className="relative z-10 flex items-start gap-3 border-t border-white/10 bg-gradient-to-r from-[#0b1020] via-[#141b2f] to-[#1a2744] px-5 py-4 sm:px-7">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
            <IconLock size={16} />
          </span>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/45">
              Sécurité du compte
            </p>
            <p className="mt-1 text-sm leading-relaxed text-white/80">
              Cookie de session sécurisé - jamais de mot de passe en clair - limite anti-bruteforce.
            </p>
          </div>
        </div>
      </article>
      <p className="mx-auto mt-4 max-w-md text-center text-[11px] text-[var(--ca-ink-subtle)]">
        En continuant, vous acceptez nos{" "}
        <Link href="/terms" className="font-semibold text-[var(--ca-accent)] hover:underline">
          conditions
        </Link>{" "}
        et la{" "}
        <Link href="/privacy" className="font-semibold text-[var(--ca-accent)] hover:underline">
          confidentialité
        </Link>
        .
      </p>
    </Section>
  );
}
