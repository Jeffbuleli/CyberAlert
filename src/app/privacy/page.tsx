import { Section } from "@/components/ui/primitives";

export default function PrivacyPage() {
  return (
    <Section className="prose-ca py-14">
      <h1 className="text-3xl font-bold">Politique de confidentialité</h1>
      <p className="mt-4 text-[var(--ca-ink-muted)]">
        Cyber Alert DRC collecte le minimum nécessaire pour fournir le service de vérification de
        liens, de signalement et de scans. Nous ne revendons pas vos données personnelles.
      </p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[var(--ca-ink-muted)]">
        <li>Link checks : URL, signaux techniques, hash d&apos;IP, horodatage.</li>
        <li>Comptes développeur : email, nom, historique de scans et findings.</li>
        <li>Paiements : références provider, montants, statut - pas de secrets carte.</li>
        <li>Les secrets découverts lors d&apos;un scan sont masqués et non stockés en clair.</li>
      </ul>
    </Section>
  );
}
