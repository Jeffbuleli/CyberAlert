"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui/primitives";

export function NewScanForm({
  projects,
}: {
  projects: { id: string; name: string; url: string }[];
}) {
  const router = useRouter();
  const [url, setUrl] = useState(projects[0]?.url || "");
  const [name, setName] = useState(projects[0]?.name || "Mon projet");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, projectName: name }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(
        data.error === "quota_exceeded"
          ? "Quota de scans épuisé."
          : data.message || "Scan impossible.",
      );
      return;
    }
    router.push(`/dashboard/scans/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-[var(--ca-border)] bg-white p-5">
      <Input
        placeholder="Nom du projet"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Input
        placeholder="https://votre-app.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
      />
      {error ? <p className="text-sm text-[var(--ca-high)]">{error}</p> : null}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Scan en cours..." : "Nouveau scan"}
      </Button>
    </form>
  );
}
