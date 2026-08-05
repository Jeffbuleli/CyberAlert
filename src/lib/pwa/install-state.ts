const STORAGE_UNTIL = "ca_pwa_install_dismiss_until";
const SESSION_PROMPTED = "ca_pwa_prompted_session";

export const PWA_DISMISS_MS = 4 * 60 * 60 * 1000;
export const PWA_IOS_DISMISS_MS = 45 * 60 * 1000;

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    nav.standalone === true
  );
}

export function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isIosInAppBrowser(): boolean {
  if (!isIosDevice()) return false;
  const ua = window.navigator.userAgent;
  if (
    /FBAN|FBAV|Instagram|Line\/|Twitter|WhatsApp|MicroMessenger|Snapchat|TikTok|Bytedance|musical_ly|Pinterest|LinkedInApp|Messenger|GSA\//i.test(
      ua,
    )
  ) {
    return true;
  }
  if (/(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(ua)) return true;
  return false;
}

export function isIosSafari(): boolean {
  if (!isIosDevice()) return false;
  if (isIosInAppBrowser()) return false;
  const ua = window.navigator.userAgent;
  if (/CriOS|FxiOS|EdgiOS|OPiOS|OPT\//i.test(ua)) return false;
  return /Safari/i.test(ua);
}

export function installDismissed(): boolean {
  try {
    const until = localStorage.getItem(STORAGE_UNTIL);
    if (!until) return false;
    return Date.now() < Number(until);
  } catch {
    return false;
  }
}

export function dismissInstallPrompt(): void {
  try {
    const ms = isIosDevice() ? PWA_IOS_DISMISS_MS : PWA_DISMISS_MS;
    localStorage.setItem(STORAGE_UNTIL, String(Date.now() + ms));
  } catch {
    /* ignore */
  }
}

export function markSessionPrompted(): void {
  try {
    sessionStorage.setItem(SESSION_PROMPTED, "1");
  } catch {
    /* ignore */
  }
}

export function wasPromptedThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_PROMPTED) === "1";
  } catch {
    return false;
  }
}

export async function hasInstalledRelatedWebApp(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (isIosDevice()) return false;
  const fn = (
    navigator as Navigator & {
      getInstalledRelatedApps?: () => Promise<{ platform: string; url?: string }[]>;
    }
  ).getInstalledRelatedApps;
  if (!fn) return false;
  try {
    const apps = await fn.call(navigator);
    return apps.some((a) => a.platform === "webapp" || a.url?.includes("manifest"));
  } catch {
    return false;
  }
}
