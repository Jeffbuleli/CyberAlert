export function buildContentSecurityPolicy(): string {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    ...(process.env.NODE_ENV !== "production" ? ["'unsafe-eval'"] : []),
    "https://challenges.cloudflare.com",
  ].join(" ");

  const r2Media = process.env.SAFEFIND_R2_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  const imgSrc = ["'self'", "data:", "blob:", ...(r2Media ? [r2Media] : [])].join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    "font-src 'self' data:",
    "connect-src 'self' https://challenges.cloudflare.com",
    "frame-src 'self' https://challenges.cloudflare.com",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function applySecurityHeaders(headers: Headers, pathname?: string) {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  const allowCamera =
    typeof pathname === "string" &&
    (pathname === "/" ||
      pathname === "/safefind" ||
      pathname.startsWith("/safefind/"));
  headers.set(
    "Permissions-Policy",
    allowCamera
      ? "camera=(self), microphone=(), geolocation=(self)"
      : "camera=(), microphone=(), geolocation=(self)",
  );
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Content-Security-Policy", buildContentSecurityPolicy());
  if (process.env.NODE_ENV === "production") {
    headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
}
