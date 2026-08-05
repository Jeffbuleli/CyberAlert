"use client";

import { useEffect } from "react";

/** Registers root SW in production so Chromium can treat the site as installable. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelled = false;

    async function register() {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        // Force activate updated SW so install criteria settle.
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        await navigator.serviceWorker.ready;
        if (!cancelled && reg.update) {
          void reg.update().catch(() => undefined);
        }
      } catch {
        /* non-fatal for Safari A2HS */
      }
    }

    void register();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
