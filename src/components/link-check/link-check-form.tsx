"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button, Input } from "@/components/ui/primitives";
import { IconSearch, IconSpinner } from "@/components/icons";

export function LinkCheckForm({ initialUrl = "" }: { initialUrl?: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Collez un lien à vérifier.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/link-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Impossible d'analyser ce lien.");
        setLoading(false);
        return;
      }
      router.push(`/check/${data.id}`);
    } catch {
      setError("Erreur réseau. Réessayez.");
      setLoading(false);
    }
  }

  return (
    <motion.form
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
      <label className="sr-only" htmlFor="link-url">
        URL à vérifier
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id="link-url"
          name="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="text-base sm:flex-1"
          disabled={loading}
        />
        <Button type="submit" disabled={loading} className="sm:min-w-[200px]">
          {loading ? <IconSpinner size={18} /> : <IconSearch size={18} />}
          {loading ? "Analyse..." : "Vérifier gratuitement"}
        </Button>
      </div>
      <p className="mt-3 text-center text-sm text-[var(--ca-ink-muted)] sm:text-left">
        Gratuit - Sans compte - Résultat rapide
      </p>
      {error ? (
        <p className="mt-2 text-sm font-medium text-[var(--ca-high)]" role="alert">
          {error}
        </p>
      ) : null}
    </motion.form>
  );
}
