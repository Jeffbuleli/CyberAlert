"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Badge, SurfaceCard } from "@/components/ui/primitives";
import type { LinkSignal } from "@/types/security";

type Tone = "critical" | "high" | "caution" | "medium" | "low" | "info";

const toneColor: Record<Tone, string> = {
  critical: "var(--ca-critical)",
  high: "var(--ca-high)",
  caution: "var(--ca-caution)",
  medium: "var(--ca-medium)",
  low: "var(--ca-low)",
  info: "var(--ca-info)",
};

export function StatCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: Tone;
  hint?: string;
}) {
  const color = toneColor[tone];
  const pct = Math.min(100, value === 0 ? 8 : 18 + Math.min(value, 20) * 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <SurfaceCard className="relative overflow-hidden p-4">
        <div
          className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-30 blur-2xl"
          style={{ background: color }}
        />
        <div className="flex items-start justify-between gap-2">
          <Badge tone={tone === "caution" ? "caution" : tone}>{label}</Badge>
          <span
            className="h-2.5 w-2.5 rounded-full shadow-[0_0_0_4px_rgba(255,255,255,0.7)]"
            style={{ background: color }}
          />
        </div>
        <p className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--ca-ink)]">
          {value}
        </p>
        {hint ? (
          <p className="mt-1 text-[11px] font-medium text-[var(--ca-ink-subtle)]">{hint}</p>
        ) : null}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--ca-surface-2)]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: color }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </SurfaceCard>
    </motion.div>
  );
}

export function RiskRadar({
  score,
  riskLevel,
}: {
  score: number;
  riskLevel: "low" | "caution" | "high";
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const color =
    riskLevel === "high"
      ? "var(--ca-high)"
      : riskLevel === "caution"
        ? "var(--ca-caution)"
        : "var(--ca-low)";
  const r = 58;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;

  return (
    <div className="relative mx-auto h-48 w-48">
      <svg viewBox="0 0 240 240" className="absolute inset-0 h-full w-full" aria-hidden>
        <circle
          cx="120"
          cy="120"
          r="110"
          fill="none"
          stroke={color}
          strokeOpacity="0.16"
          strokeDasharray="3 7"
          strokeWidth="1.25"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 120 120"
            to="360 120 120"
            dur="28s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="120" cy="120" r="98" fill="none" stroke={color} strokeOpacity="0.08" />
        <g stroke={color} strokeOpacity="0.2" strokeWidth="1.25">
          <path d="M26 68h20M26 68v20M214 68h-20M214 68v20M26 172h20M26 172v-20M214 172h-20M214 172v-20" />
        </g>
      </svg>
      <div
        className="ca-pulse-ring absolute inset-8 rounded-full border"
        style={{ borderColor: color }}
      />
      <svg viewBox="0 0 140 140" className="absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] -rotate-90">
        <defs>
          <linearGradient id="ca-score-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1f4fd8" />
            <stop offset="55%" stopColor={color} />
            <stop offset="100%" stopColor="#e25a2c" />
          </linearGradient>
        </defs>
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(15,35,70,0.08)" strokeWidth="11" />
        <motion.circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="url(#ca-score-grad)"
          strokeWidth="11"
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${c}` }}
          animate={{ strokeDasharray: `${dash} ${c}` }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
        <circle cx="70" cy="70" r="26" fill="none" stroke="rgba(31,79,216,0.14)" strokeWidth="1" />
        <circle cx="70" cy="70" r="40" fill="none" stroke="rgba(31,79,216,0.1)" strokeWidth="1" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold tracking-tight" style={{ color }}>
          {clamped}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ca-ink-subtle)]">
          score
        </span>
      </div>
    </div>
  );
}

/** Polished severity histogram from link signals (hackathon-pass inspired bars). */
export function SignalHistogram({ signals }: { signals: LinkSignal[] }) {
  const buckets: { key: Tone; label: string; count: number }[] = [
    { key: "high", label: "Élevé", count: 0 },
    { key: "medium", label: "Moyen", count: 0 },
    { key: "low", label: "Faible", count: 0 },
    { key: "info", label: "Info", count: 0 },
  ];

  for (const s of signals) {
    if (s.severity === "high") buckets[0].count += 1;
    else if (s.severity === "medium") buckets[1].count += 1;
    else if (s.severity === "low") buckets[2].count += 1;
    else buckets[3].count += 1;
  }

  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className="rounded-[22px] border border-[var(--ca-border)] bg-white/80 p-4 shadow-[var(--ca-shadow-soft)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--ca-accent)]">
          Répartition des signaux
        </p>
        <span className="text-[11px] font-semibold text-[var(--ca-ink-subtle)]">
          {signals.length} {signals.length === 1 ? "signal" : "signaux"}
        </span>
      </div>
      <div className="mt-4 flex h-36 items-end gap-3">
        {buckets.map((b, i) => {
          const h = b.count === 0 ? 10 : Math.max(22, Math.round((b.count / max) * 100));
          const color = toneColor[b.key];
          return (
            <div key={b.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <span className="text-xs font-extrabold tabular-nums text-[var(--ca-ink)]">
                {b.count}
              </span>
              <div className="relative flex h-28 w-full items-end justify-center rounded-2xl bg-[var(--ca-surface-2)]/70 px-1.5 pb-1.5">
                <motion.div
                  className="w-full max-w-[42px] rounded-xl shadow-[0_10px_24px_-14px_rgba(12,24,48,0.45)]"
                  style={{
                    background: `linear-gradient(180deg, ${color} 0%, #0b1020 160%)`,
                  }}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.7, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <span className="truncate text-[10px] font-bold tracking-wide text-[var(--ca-ink-muted)]">
                {b.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ServiceTile({
  href,
  title,
  description,
  icon,
  accent,
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  accent: string;
}) {
  return (
    <Link href={href} className="group block">
      <SurfaceCard className="h-full p-5 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[var(--ca-shadow-lift)]">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_10px_20px_-10px_rgba(0,0,0,0.35)]"
            style={{ background: accent }}
          >
            {icon}
          </div>
          <h3 className="min-w-0 text-base font-semibold leading-snug text-[var(--ca-ink)]">
            {title}
          </h3>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[var(--ca-ink-muted)]">{description}</p>
        <span className="mt-4 inline-flex text-xs font-semibold text-[var(--ca-accent)]">
          Continuer -
        </span>
      </SurfaceCard>
    </Link>
  );
}

/** Icon left + title right (same row), explanation below. */
export function FeatureCard({
  icon,
  title,
  description,
  accent = "var(--ca-accent)",
  eyebrow,
  className = "",
}: {
  icon: ReactNode;
  title: string;
  description: string;
  accent?: string;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <SurfaceCard className={`h-full p-5 ${className}`}>
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_10px_20px_-10px_rgba(0,0,0,0.35)]"
          style={{ background: accent }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--ca-ink-subtle)]">
              {eyebrow}
            </p>
          ) : null}
          <h3 className="text-base font-bold leading-snug text-[var(--ca-ink)]">{title}</h3>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[var(--ca-ink-muted)]">{description}</p>
    </SurfaceCard>
  );
}
