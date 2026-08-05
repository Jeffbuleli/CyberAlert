import { makeSignal } from "@/lib/security-core/types";
import type { LinkSignal } from "@/types/security";

const SHORTENER_HOSTS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "rebrand.ly",
  "cutt.ly",
  "rb.gy",
  "shorturl.at",
]);

/** Fast local heuristics — no network. */
export function runLocalHeuristicsTool(url: URL): { tool: "LocalHeuristicsTool"; signals: LinkSignal[] } {
  const signals: LinkSignal[] = [];

  if (url.protocol !== "https:") {
    signals.push(
      makeSignal({
        code: "no_https",
        title: "Connexion non chiffrée (HTTP)",
        severity: "medium",
        confidence: 90,
        description: "Le lien n'utilise pas HTTPS. Les données pourraient être interceptées.",
        evidence: [`protocol=${url.protocol}`],
        recommendation: "Évitez de saisir des mots de passe ou données bancaires sur HTTP.",
      }),
    );
  }

  if (url.username || url.password) {
    signals.push(
      makeSignal({
        code: "userinfo_in_url",
        title: "Identifiants dans l'URL",
        severity: "high",
        confidence: 85,
        description: "L'URL contient un nom d'utilisateur ou un mot de passe intégré.",
        evidence: ["userinfo_present=true"],
      }),
    );
  }

  if (SHORTENER_HOSTS.has(url.hostname.toLowerCase())) {
    signals.push(
      makeSignal({
        code: "url_shortener",
        title: "URL raccourcie",
        severity: "medium",
        confidence: 70,
        description:
          "Les liens raccourcis masquent la destination réelle. Nous tentons d'examiner la redirection.",
        evidence: [`shortener=${url.hostname}`],
      }),
    );
  }

  if (/login|signin|verify|account|secure|update|password|wallet|otp/i.test(url.pathname + url.search)) {
    signals.push(
      makeSignal({
        code: "phishing_keywords",
        title: "Mots-clés souvent liés au phishing",
        severity: "medium",
        confidence: 55,
        description:
          "Le chemin ou les paramètres contiennent des termes fréquemment utilisés dans des pages de connexion frauduleuses.",
        evidence: [`path=${url.pathname}`],
      }),
    );
  }

  if (url.hostname.split(".").length > 4) {
    signals.push(
      makeSignal({
        code: "deep_subdomains",
        title: "Sous-domaines inhabituellement nombreux",
        severity: "low",
        confidence: 50,
        description: "Une profondeur élevée de sous-domaines peut servir à tromper l'œil.",
        evidence: [`hostname=${url.hostname}`],
      }),
    );
  }

  return { tool: "LocalHeuristicsTool", signals };
}
