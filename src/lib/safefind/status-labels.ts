/** French labels for public SafeFind status slugs (from toPublicCaseView). */
export function safefindStatusDisplayLabel(status: string): string {
  const map: Record<string, string> = {
    securise: "Sécurisé au Point SafeFind",
    pret_retrait: "Prêt au retrait",
    retrait_reserve: "Retrait réservé",
    correspondance: "Correspondance en cours",
    verification: "Vérification propriétaire",
    declare: "Déclaré",
    enregistre: "Enregistré",
    depot_en_attente: "Dépôt en attente",
    chez_trouveur: "Chez le trouveur",
    livraison: "Livraison",
    remis: "Remis",
    restitue: "Restitué",
    perdu: "Perdu",
    en_cours: "En cours",
    en_litige: "En litige",
    incident: "Incident partenaire",
    annule: "Annulé",
    expire: "Expiré",
    recompense_en_cours: "Récompense en cours",
    clos: "Clôturé",
    signale: "Signalé volé",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

export type SafefindCasePhase =
  | "finder_awaiting_deposit"
  | "finder_published"
  | "owner_claim"
  | "owner_lost"
  | "owner_restitution"
  | "readonly";
