import {
  EMAIL_BRAND,
  logoUrl,
} from "@/lib/email/config";

export type EmailCopy = {
  subject: string;
  preheader: string;
  title: string;
  body: string;
  cta: string;
  expiry?: string;
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** McBuleli-style branded layout (same structure as McBuleliP2P Resend emails). */
export function renderBrandedEmail(copy: EmailCopy, actionUrl: string): {
  html: string;
  text: string;
  subject: string;
} {
  const href = esc(actionUrl);
  const year = new Date().getFullYear();
  const logo = logoUrl();

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${EMAIL_BRAND.text};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(copy.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6f4;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${EMAIL_BRAND.white};border:1px solid ${EMAIL_BRAND.border};border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:22px 24px 10px;background:${EMAIL_BRAND.mint};border-bottom:1px solid ${EMAIL_BRAND.border};">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <img src="${logo}" width="48" height="48" alt="McBuleli" style="display:block;border:0;border-radius:10px;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="font-size:15px;font-weight:800;color:${EMAIL_BRAND.green};">Cyber Alert DRC</div>
                    <div style="font-size:12px;color:${EMAIL_BRAND.muted};">par McBuleli</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 8px;">
              <h1 style="margin:0;font-size:22px;line-height:1.25;color:${EMAIL_BRAND.text};">${esc(copy.title)}</h1>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.55;color:${EMAIL_BRAND.muted};">${esc(copy.body)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px 8px;" align="center">
              <a href="${href}" style="display:inline-block;background:${EMAIL_BRAND.accent};color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:12px;">${esc(copy.cta)}</a>
            </td>
          </tr>
          ${
            copy.expiry
              ? `<tr><td style="padding:8px 24px 0;"><p style="margin:0;font-size:12px;color:${EMAIL_BRAND.muted};text-align:center;">${esc(copy.expiry)}</p></td></tr>`
              : ""
          }
          <tr>
            <td style="padding:22px 24px 26px;">
              <p style="margin:0;font-size:11px;line-height:1.5;color:${EMAIL_BRAND.muted};word-break:break-all;">
                Si le bouton ne fonctionne pas : ${href}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 22px;border-top:1px solid ${EMAIL_BRAND.border};text-align:center;background:#fafcfb;">
              <img src="${logo}" width="32" height="32" alt="" style="display:block;margin:0 auto 8px;border:0;border-radius:6px;opacity:0.9;" />
              <p style="margin:0;font-size:11px;color:${EMAIL_BRAND.muted};">Powered by McBuleli</p>
              <p style="margin:6px 0 0;font-size:11px;color:${EMAIL_BRAND.muted};">© ${year} McBuleli. Tous droits réservés.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    copy.title,
    "",
    copy.body,
    "",
    `${copy.cta}: ${actionUrl}`,
    copy.expiry || "",
    "",
    "Powered by McBuleli",
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text, subject: copy.subject };
}

export const EMAIL_COPY = {
  verify: {
    subject: "Confirmez votre email - Cyber Alert DRC",
    preheader: "Un clic pour activer votre compte.",
    title: "Vérifiez votre email",
    body: "Bienvenue sur Cyber Alert DRC - confirmez votre adresse pour sécuriser votre compte développeur.",
    cta: "Confirmer mon email",
    expiry: "Ce lien expire dans 24 h.",
  },
  passwordReset: {
    subject: "Réinitialiser votre mot de passe - Cyber Alert DRC",
    preheader: "Lien sécurisé pour choisir un nouveau mot de passe.",
    title: "Mot de passe oublié ?",
    body: "Utilisez le bouton ci-dessous pour définir un nouveau mot de passe.",
    cta: "Réinitialiser",
    expiry: "Lien valide 1 h. Ignorez si vous n'êtes pas à l'origine de la demande.",
  },
  welcome: {
    subject: "Bienvenue sur Cyber Alert DRC",
    preheader: "Votre espace développeur est prêt.",
    title: "Compte créé",
    body: "Votre espace développeur Cyber Alert DRC est prêt. Confirmez votre email pour activer toutes les notifications.",
    cta: "Ouvrir mon espace",
    expiry: undefined,
  },
} as const;
