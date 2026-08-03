import {
  appBaseUrl,
  emailFromAddress,
  emailReplyTo,
} from "@/lib/email/config";
import { EMAIL_COPY, renderBrandedEmail } from "@/lib/email/layout";

export function canSendViaResendApi(): boolean {
  if (!process.env.RESEND_API_KEY?.trim()) return false;
  if (process.env.NODE_ENV === "production") return true;
  const allow = (process.env.RESEND_ALLOW_SEND ?? "").trim().toLowerCase();
  return allow === "1" || allow === "true" || allow === "yes";
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  const from = emailFromAddress();
  const replyTo = emailReplyTo();

  if (!canSendViaResendApi()) {
    console.warn("[email] not sent (Resend disabled or missing key)", {
      to: args.to,
      subject: args.subject,
    });
    return false;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  }).catch((err) => {
    console.error("[email] resend fetch failed", err);
    return null;
  });

  if (!res) return false;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[email] resend error", res.status, body);
    return false;
  }
  return true;
}

export async function sendAuthEmail(args: {
  to: string;
  kind: keyof typeof EMAIL_COPY;
  actionUrl: string;
}): Promise<boolean> {
  const copy = EMAIL_COPY[args.kind];
  const rendered = renderBrandedEmail(copy, args.actionUrl);
  return sendEmail({
    to: args.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
}

export { appBaseUrl };
