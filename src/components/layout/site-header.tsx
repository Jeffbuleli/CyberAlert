"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { IconLock } from "@/components/icons";

const links = [
  { href: "/", label: "Vérifier" },
  { href: "/report", label: "Signaler" },
  { href: "/developers", label: "Développeurs" },
  { href: "/business", label: "Entreprises" },
  { href: "/safefind", label: "SafeFind" },
];

export type HeaderUser = {
  name: string | null;
  email: string;
  role: string;
};

export function SiteHeader({ user = null }: { user?: HeaderUser | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const signedIn = Boolean(user);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const firstName = user?.name?.trim() || user?.email.split("@")[0] || "Compte";

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--ca-border)]/70 bg-[rgba(233,238,245,0.88)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-3 sm:h-16 sm:gap-4 sm:px-4">
        <Link
          href="/"
          className="flex min-w-0 flex-1 items-center gap-2.5 font-semibold text-[var(--ca-ink)] sm:gap-3 sm:flex-none"
        >
          <BrandLogo size={44} priority />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[13px] font-extrabold tracking-tight sm:text-sm">
              Cyber Alert DRC
            </span>
            <span className="hidden text-[10px] font-medium text-[var(--ca-ink-muted)] sm:block">
              Vérifiez avant de faire confiance.
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-2xl border border-[var(--ca-border)] bg-white/80 p-1 shadow-[var(--ca-shadow-soft)] md:flex">
          {links.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--ca-accent-soft)] text-[var(--ca-accent)]"
                    : "text-[var(--ca-ink-muted)] hover:bg-[var(--ca-accent-soft)] hover:text-[var(--ca-accent)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {signedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex max-w-[10.5rem] items-center justify-center gap-1.5 rounded-2xl bg-[var(--ca-accent)] px-3.5 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_-14px_rgba(31,79,216,0.65)] transition hover:bg-[#1a45c4] active:scale-[0.98] sm:max-w-none sm:px-4"
            >
              <span className="truncate">{firstName}</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[var(--ca-accent)] px-3.5 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_-14px_rgba(31,79,216,0.65)] transition hover:bg-[#1a45c4] active:scale-[0.98] sm:px-4"
            >
              <IconLock size={15} className="opacity-90" />
              Connexion
            </Link>
          )}

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--ca-border)] bg-white/90 text-[var(--ca-ink)] shadow-sm md:hidden"
            aria-expanded={open}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">Menu</span>
            <span className="flex w-4 flex-col gap-1">
              <span
                className={`h-0.5 rounded-full bg-current transition ${open ? "translate-y-1.5 rotate-45" : ""}`}
              />
              <span className={`h-0.5 rounded-full bg-current transition ${open ? "opacity-0" : ""}`} />
              <span
                className={`h-0.5 rounded-full bg-current transition ${open ? "-translate-y-1.5 -rotate-45" : ""}`}
              />
            </span>
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-[var(--ca-border)] bg-white/95 px-3 py-3 backdrop-blur md:hidden">
          <nav className="mx-auto flex max-w-5xl flex-col gap-1">
            {links.map((l) => {
              const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                    active
                      ? "bg-[var(--ca-accent-soft)] text-[var(--ca-accent)]"
                      : "text-[var(--ca-ink)] hover:bg-[var(--ca-surface-2)]"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
            <Link
              href="/pricing"
              className="rounded-2xl px-4 py-3 text-sm font-semibold text-[var(--ca-ink)] hover:bg-[var(--ca-surface-2)]"
            >
              Tarifs
            </Link>
            {signedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-2xl px-4 py-3 text-sm font-semibold text-[var(--ca-ink)] hover:bg-[var(--ca-surface-2)]"
                >
                  Mon espace
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="rounded-2xl px-4 py-3 text-sm font-semibold text-[var(--ca-ink)] hover:bg-[var(--ca-surface-2)]"
                >
                  Paramètres
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-2xl px-4 py-3 text-sm font-semibold text-[var(--ca-accent)] hover:bg-[var(--ca-accent-soft)]"
              >
                Connexion
              </Link>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
