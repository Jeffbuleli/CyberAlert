export function appBaseUrl(): string {
  return (
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3010"
  ).replace(/\/$/, "");
}

export function emailFromAddress(): string {
  return (
    process.env.AUTH_EMAIL_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    "Cyber Alert DRC <noreply@mcbuleli.org>"
  );
}

export function emailReplyTo(): string | undefined {
  const v = process.env.AUTH_EMAIL_REPLY_TO?.trim() || process.env.SUPPORT_EMAIL?.trim();
  return v || undefined;
}

export const EMAIL_BRAND = {
  green: "#305f33",
  mint: "#e8f3ee",
  border: "#d5e5db",
  text: "#16301c",
  muted: "#5f7a68",
  white: "#ffffff",
  accent: "#1f4fd8",
};

export function logoUrl(): string {
  return "https://mcbuleli.org/brand/logo-256.png";
}
