"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input, Section } from "@/components/ui/primitives";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.message || "Inscription impossible.");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <Section className="py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-[var(--ca-border)] bg-white p-6 sm:p-8">
        <h1 className="text-2xl font-bold">Créer un compte</h1>
        <p className="mt-1 text-sm text-[var(--ca-ink-muted)]">
          Free tier : 1 projet - 2 scans / mois.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="mot de passe (8+ caractères)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          {error ? <p className="text-sm text-[var(--ca-high)]">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            Créer mon compte
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-[var(--ca-ink-muted)]">
          Déjà inscrit ?{" "}
          <Link href="/login" className="font-semibold text-[var(--ca-accent)]">
            Connexion
          </Link>
        </p>
      </div>
    </Section>
  );
}
