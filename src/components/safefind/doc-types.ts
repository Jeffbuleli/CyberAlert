export const SAFEFIND_DOC_OPTIONS = [
  { value: "carte_electeur", label: "Carte d’électeur" },
  { value: "passeport", label: "Passeport" },
  { value: "permis_conduire", label: "Permis de conduire" },
] as const;

export type SafefindDocOption = (typeof SAFEFIND_DOC_OPTIONS)[number]["value"];
