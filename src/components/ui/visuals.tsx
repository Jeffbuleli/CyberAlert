"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Badge, SurfaceCard } from "@/components/ui/primitives";

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
  const r = 54;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;

  return (
    <div className="relative mx-auto h-40 w-40">
      <div
        className="ca-pulse-ring absolute inset-4 rounded-full border"
        style={{ borderColor: color }}
      />
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="rgba(15,35,70,0.08)"
          strokeWidth="10"
        />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
        <circle cx="70" cy="70" r="24" fill="none" stroke="rgba(31,79,216,0.15)" strokeWidth="1" />
        <circle cx="70" cy="70" r="38" fill="none" stroke="rgba(31,79,216,0.12)" strokeWidth="1" />
        <line x1="70" y1="16" x2="70" y2="124" stroke="rgba(31,79,216,0.1)" />
        <line x1="16" y1="70" x2="124" y2="70" stroke="rgba(31,79,216,0.1)" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold tracking-tight" style={{ color }}>
          {clamped}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ca-ink-subtle)]">
          score
        </span>
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
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-[0_10px_20px_-10px_rgba(0,0,0,0.35)]"
          style={{ background: accent }}
        >
          {icon}
        </div>
        <h3 className="mt-4 text-base font-semibold text-[var(--ca-ink)]">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--ca-ink-muted)]">{description}</p>
        <span className="mt-4 inline-flex text-xs font-semibold text-[var(--ca-accent)]">
          Continuer -
        </span>
      </SurfaceCard>
    </Link>
  );
}
