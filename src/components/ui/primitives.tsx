import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

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
      ? "bg-[var(--ca-accent)] text-white hover:bg-[var(--ca-accent-hover)] shadow-sm"
      : variant === "secondary"
        ? "bg-white text-[var(--ca-ink)] border border-[var(--ca-border)] hover:bg-[var(--ca-surface-2)]"
        : variant === "danger"
          ? "bg-[var(--ca-high)] text-white hover:opacity-90"
          : "bg-transparent text-[var(--ca-ink-muted)] hover:text-[var(--ca-ink)]";
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition disabled:opacity-50 disabled:pointer-events-none ${styles} ${className}`}
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
      className={`w-full rounded-xl border border-[var(--ca-border)] bg-white px-4 py-3.5 text-[var(--ca-ink)] placeholder:text-[var(--ca-ink-subtle)] outline-none focus:border-[var(--ca-accent)] focus:ring-2 focus:ring-[var(--ca-accent-soft)] ${className}`}
      {...props}
    />
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "low" | "caution" | "high" | "info";
  children: ReactNode;
}) {
  const map = {
    neutral: "bg-[var(--ca-surface-2)] text-[var(--ca-ink-muted)]",
    low: "bg-[var(--ca-low-soft)] text-[var(--ca-low)]",
    caution: "bg-[var(--ca-caution-soft)] text-[var(--ca-caution)]",
    high: "bg-[var(--ca-high-soft)] text-[var(--ca-high)]",
    info: "bg-[var(--ca-accent-soft)] text-[var(--ca-accent)]",
  };
  return (
    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${map[tone]}`}>
      {children}
    </span>
  );
}

export function Section({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`mx-auto w-full max-w-5xl px-4 ${className}`}>{children}</section>;
}
