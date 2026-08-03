import { Suspense } from "react";
import ReportClient from "./report-client";
import { Section } from "@/components/ui/primitives";

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <Section className="py-16">
          <p className="text-sm text-[var(--ca-ink-muted)]">Chargement...</p>
        </Section>
      }
    >
      <ReportClient />
    </Suspense>
  );
}
