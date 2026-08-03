import { Section } from "@/components/ui/primitives";

export default function ResponsibleDisclosurePage() {
  return (
    <Section className="py-14">
      <h1 className="text-3xl font-bold">Divulgation responsable</h1>
      <p className="mt-4 text-sm leading-relaxed text-[var(--ca-ink-muted)]">
        Si vous découvrez une vulnérabilité sur Cyber Alert DRC, contactez-nous de manière privée.
        N&apos;exploitez pas la faille, n&apos;accédez pas aux données de tiers, et accordez un délai
        raisonnable avant toute divulgation publique. Un domaine public n&apos;autorise pas des tests
        de pénétration.
      </p>
    </Section>
  );
}
