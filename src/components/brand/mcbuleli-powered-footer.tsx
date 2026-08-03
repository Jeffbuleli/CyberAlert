"use client";

import Image from "next/image";
import Link from "next/link";

/** Exact McBuleli powered-by pattern (adapted from McBuleliP2P), link → mcbuleli.org */
export function McBuleliPoweredFooter() {
  return (
    <div className="flex flex-col items-center gap-1.5 pt-2">
      <a
        href="https://mcbuleli.org"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-[11px] text-[var(--ca-ink-muted)] transition hover:text-[var(--ca-ink)]"
      >
        <span className="font-medium opacity-80">Powered by</span>
        <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-[var(--ca-border)] bg-white">
          <Image
            src="/brand/mcbuleli-mark-256.png"
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 object-contain"
            unoptimized
          />
        </span>
        <span className="font-extrabold text-[var(--ca-accent)]">McBuleli</span>
      </a>
    </div>
  );
}
