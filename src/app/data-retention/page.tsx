import { Section } from "@/components/ui/primitives";

export default function DataRetentionPage() {
  return (
    <Section className="py-14">
      <h1 className="text-3xl font-bold">Conservation des données</h1>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[var(--ca-ink-muted)]">
        <li>Link checks anonymisés : rétention limitée (exploitation / abuse).</li>
        <li>Comptes et scans : tant que le compte est actif, puis suppression sur demande.</li>
        <li>Signalements : conservés pour modération et historique de menace.</li>
        <li>Paiements : conservation comptable selon obligations applicables.</li>
      </ul>
    </Section>
  );
}
