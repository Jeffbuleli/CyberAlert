"use client";

type Props = {
  casePublicId?: string | null;
  partnerName?: string | null;
  variant?: "finder" | "partner";
};

export function SafefindDepositProcedure({
  casePublicId,
  partnerName,
  variant = "finder",
}: Props) {
  const steps =
    variant === "partner"
      ? [
          {
            n: 1,
            title: "Vérifier le dossier",
            body: "Le trouveur présente le code SafeFind (SF-…) et la pièce physique.",
          },
          {
            n: 2,
            title: "Contrôler l’identité",
            body: "Type de pièce, état, correspondance avec la déclaration (photo floutée).",
          },
          {
            n: 3,
            title: "Confirmer le dépôt",
            body: "Appuyez sur « Confirmer et publier » — la fiche apparaît sur le Marketplace.",
          },
        ]
      : [
          {
            n: 1,
            title: "Conservez la pièce",
            body: "Ne la remettez à personne en dehors du Point SafeFind.",
          },
          {
            n: 2,
            title: "Allez au Point assigné",
            body: partnerName
              ? `Déposez au guichet SafeFind « ${partnerName} ».`
              : "Déposez au Point SafeFind choisi lors de la déclaration.",
          },
          {
            n: 3,
            title: "Présentez votre code",
            body: casePublicId
              ? `Montrez ce code au partenaire : ${casePublicId}`
              : "Montrez le code SafeFind affiché dans Mes dossiers.",
          },
          {
            n: 4,
            title: "Publication",
            body: "Une fois le partenaire confirme, votre fiche est publiée sur le Marketplace (photo floutée).",
          },
        ];

  return (
    <ol className="space-y-3">
      {steps.map((s) => (
        <li key={s.n} className="flex gap-3 text-sm">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ca-accent)]/15 text-xs font-bold text-[var(--ca-accent)]">
            {s.n}
          </span>
          <div>
            <p className="font-semibold text-[var(--ca-ink)]">{s.title}</p>
            <p className="text-xs leading-relaxed text-[var(--ca-ink-muted)]">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
