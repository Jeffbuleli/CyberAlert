import { Section } from "@/components/ui/primitives";

export default function TermsPage() {
  return (
    <Section className="py-14">
      <h1 className="text-3xl font-bold">Conditions d&apos;utilisation</h1>
      <p className="mt-4 text-sm leading-relaxed text-[var(--ca-ink-muted)]">
        Cyber Alert DRC fournit des analyses indicatives. Un résultat « risque faible » ne signifie
        pas qu&apos;un site est sûr à 100 %. Un résultat « risque élevé » n&apos;est pas une accusation
        juridique automatique. Les scans développeur sont non-intrusifs hors périmètre autorisé. Les
        tests offensifs nécessitent une autorisation écrite et un scope explicite.
      </p>
    </Section>
  );
}
