import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const styles =
    variant === "primary"
      ? "bg-[var(--ca-accent)] text-white hover:bg-[var(--ca-accent-hover)] shadow-[0_10px_24px_-10px_var(--ca-accent-glow)]"
      : variant === "secondary"
        ? "ca-neo text-[var(--ca-ink)] hover:bg-[var(--ca-surface-2)]"
        : variant === "danger"
          ? "bg-[var(--ca-high)] text-white hover:opacity-90 shadow-[0_10px_24px_-10px_rgba(226,90,44,0.45)]"
          : "bg-transparent text-[var(--ca-ink-muted)] hover:text-[var(--ca-ink)] hover:bg-white/50";
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:opacity-50 disabled:pointer-events-none ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-2xl border border-[var(--ca-border-strong)] bg-white/90 px-4 py-3.5 text-[var(--ca-ink)] shadow-[var(--ca-inset)] placeholder:text-[var(--ca-ink-subtle)] outline-none focus:border-[var(--ca-accent)] focus:ring-4 focus:ring-[var(--ca-accent-soft)] ${className}`}
      {...props}
    />
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "low" | "caution" | "high" | "critical" | "medium" | "info";
  children: ReactNode;
}) {
  const map = {
    neutral: "bg-[var(--ca-surface-2)] text-[var(--ca-ink-muted)]",
    low: "bg-[var(--ca-low-soft)] text-[var(--ca-low)]",
    caution: "bg-[var(--ca-caution-soft)] text-[var(--ca-caution)]",
    medium: "bg-[var(--ca-medium-soft)] text-[var(--ca-medium)]",
    high: "bg-[var(--ca-high-soft)] text-[var(--ca-high)]",
    critical: "bg-[var(--ca-critical-soft)] text-[var(--ca-critical)]",
    info: "bg-[var(--ca-info-soft)] text-[var(--ca-info)]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ${map[tone]}`}
    >
      {children}
    </span>
  );
}

export function Section({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`mx-auto w-full max-w-5xl px-4 ${className}`}>
      {children}
    </section>
  );
}

export function SurfaceCard({
  children,
  className = "",
  variant = "neo",
}: {
  children: ReactNode;
  className?: string;
  variant?: "neo" | "lift" | "inset" | "panther";
}) {
  const v =
    variant === "lift"
      ? "ca-lift"
      : variant === "inset"
        ? "ca-neo-inset"
        : variant === "panther"
          ? "ca-panther-panel"
          : "ca-neo";
  return <div className={`rounded-[1.35rem] ${v} ${className}`}>{children}</div>;
}

export function MetaChip({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border border-[var(--ca-border)] bg-white/80 px-2.5 py-1 text-[10px] font-bold tracking-wide text-[var(--ca-ink)] shadow-sm backdrop-blur-sm ${className}`}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

export function TextArea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-2xl border border-[var(--ca-border-strong)] bg-white/90 px-4 py-3.5 text-[var(--ca-ink)] shadow-[var(--ca-inset)] placeholder:text-[var(--ca-ink-subtle)] outline-none focus:border-[var(--ca-accent)] focus:ring-4 focus:ring-[var(--ca-accent-soft)] ${className}`}
      {...props}
    />
  );
}
