"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";
import { IconCheck, IconFlag } from "@/components/icons";
import {
  Badge,
  Button,
  Input,
  MetaChip,
  Section,
  TextArea,
} from "@/components/ui/primitives";
import {
  REPORT_CATEGORIES,
  categoryLabel,
  domainFromUrl,
  shortReportId,
} from "@/lib/reports/labels";

export default function ReportClient() {
  const sp = useSearchParams();
  const [url, setUrl] = useState(sp.get("url") || "");
  const [category, setCategory] = useState("phishing");
  const [comment, setComment] = useState("");
  const [source, setSource] = useState("");
  const [doneId, setDoneId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fromCheck = useMemo(() => sp.get("from"), [sp]);
  const domain = domainFromUrl(url);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          category,
          comment: comment.trim() || undefined,
          source: source.trim() || undefined,
          linkCheckId: fromCheck || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(
          data.message ||
            (res.status === 429
              ? "Trop de signalements. Réessayez dans une minute."
              : "Envoi impossible. Vérifiez l'URL et réessayez."),
        );
        setLoading(false);
        return;
      }
      setDoneId(data.id || "ok");
    } catch {
      setError("Erreur réseau. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section className="py-10 sm:py-14">
      <article className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-[28px] border border-[var(--ca-border)] bg-[#FAFBFE] shadow-[0_24px_64px_-30px_rgba(12,24,48,0.45)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse at top right, color-mix(in srgb, var(--ca-high) 14%, transparent), transparent 55%)",
          }}
        />

        <div className="relative z-10 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <BrandLogo size={56} priority />
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--ca-high)]">
                  Cyber Alert DRC · Signalement
                </p>
                <h1 className="text-xl font-extrabold tracking-tight text-[var(--ca-ink)] sm:text-2xl">
                  Signaler un site
                </h1>
              </div>
            </div>
            <Badge tone="caution">Examen humain</Badge>
          </div>

          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--ca-ink-muted)]">
            Sans compte. Votre signal entre dans une file de modération - aucune publication
            automatique, aucune accusation définitive.
          </p>

          {(url || fromCheck) && !doneId ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {domain ? <MetaChip label={domain} /> : null}
              {fromCheck ? <MetaChip label="Depuis une vérification" /> : null}
              <MetaChip label="File privée" />
            </div>
          ) : null}

          {doneId ? (
            <div className="mt-8 space-y-5">
              <div className="flex items-start gap-3 rounded-[22px] border border-[var(--ca-low)]/25 bg-[var(--ca-low-soft)]/60 px-4 py-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--ca-low)] text-white">
                  <IconCheck size={20} />
                </span>
                <div>
                  <h2 className="font-bold text-[var(--ca-ink)]">Merci - signal reçu</h2>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--ca-ink-muted)]">
                    Notre équipe examinera ce signal avant toute action. Rien n&apos;est publié
                    automatiquement.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <MetaChip label={`Réf. ${shortReportId(doneId)}`} />
                <MetaChip label={categoryLabel(category)} />
                {domain ? <MetaChip label={domain} /> : null}
                <Badge tone="caution">En file de modération</Badge>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/" className="sm:flex-1">
                  <Button type="button" className="w-full">
                    Vérifier un autre lien
                  </Button>
                </Link>
                {fromCheck ? (
                  <Link href={`/check/${fromCheck}`} className="sm:flex-1">
                    <Button type="button" variant="secondary" className="w-full">
                      Retour au résultat
                    </Button>
                  </Link>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:flex-1"
                    onClick={() => {
                      setDoneId(null);
                      setComment("");
                      setSource("");
                    }}
                  >
                    Nouveau signalement
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-7 space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[var(--ca-ink)]">
                  URL signalée
                </label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://exemple.com/…"
                  required
                  autoComplete="url"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--ca-ink)]">
                  Type de risque
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                  {REPORT_CATEGORIES.map((c) => {
                    const active = category === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setCategory(c.value)}
                        className={`rounded-2xl border px-3 py-2.5 text-left transition ${
                          active
                            ? "border-[var(--ca-high)] bg-[var(--ca-high-soft)] shadow-[0_8px_20px_-14px_rgba(226,90,44,0.55)]"
                            : "border-[var(--ca-border)] bg-white/80 hover:border-[var(--ca-border-strong)]"
                        }`}
                      >
                        <span className="block text-xs font-bold text-[var(--ca-ink)]">
                          {c.label}
                        </span>
                        <span className="mt-0.5 block text-[10px] font-medium text-[var(--ca-ink-subtle)]">
                          {c.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="text-sm font-semibold text-[var(--ca-ink)]">
                    Commentaire <span className="font-medium text-[var(--ca-ink-subtle)]">(facultatif)</span>
                  </label>
                  <span className="text-[10px] font-semibold tabular-nums text-[var(--ca-ink-subtle)]">
                    {comment.length}/2000
                  </span>
                </div>
                <TextArea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="Décrivez ce qui vous a mis la puce à l'oreille…"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[var(--ca-ink)]">
                  Où avez-vous reçu le lien ?{" "}
                  <span className="font-medium text-[var(--ca-ink-subtle)]">(facultatif)</span>
                </label>
                <Input
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="WhatsApp, SMS, email, Facebook…"
                  maxLength={64}
                />
              </div>

              {error ? (
                <p className="rounded-2xl border border-[var(--ca-high)]/20 bg-[var(--ca-high-soft)] px-3 py-2.5 text-sm font-medium text-[var(--ca-high)]">
                  {error}
                </p>
              ) : null}

              <Button type="submit" variant="danger" disabled={loading || !url.trim()} className="w-full">
                <IconFlag size={18} />
                {loading ? "Envoi…" : "Envoyer le signalement"}
              </Button>
            </form>
          )}
        </div>

        <div className="relative z-10 border-t border-white/10 bg-gradient-to-r from-[#0b1020] via-[#141b2f] to-[#2a1a14] px-5 py-4 sm:px-7">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/45">
            Engagement
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-white/80">
            Examen humain - aucune accusation automatique. Les signalements aident à protéger la
            communauté en RDC.
          </p>
        </div>
      </article>
    </Section>
  );
}
