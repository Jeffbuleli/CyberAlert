"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/primitives";
import {
  dismissInstallPrompt,
  hasInstalledRelatedWebApp,
  installDismissed,
  isIosDevice,
  isIosInAppBrowser,
  isIosSafari,
  isStandaloneDisplay,
  markSessionPrompted,
  wasPromptedThisSession,
} from "@/lib/pwa/install-state";
import type { BeforeInstallPromptEvent } from "@/types/pwa";

const PROMPT_DELAY_MS = 2200;
const INSTALLED_FLAG = "ca_pwa_installed";

const AUTH_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]);

function markInstalledLocally() {
  try {
    localStorage.setItem(INSTALLED_FLAG, "1");
  } catch {
    /* ignore */
  }
}

function wasInstalledLocally() {
  try {
    return localStorage.getItem(INSTALLED_FLAG) === "1";
  } catch {
    return false;
  }
}

export function PwaInstallBanner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [ios, setIos] = useState(false);
  const [iosSafari, setIosSafari] = useState(false);
  const [iosInApp, setIosInApp] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installedRelated, setInstalledRelated] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [done, setDone] = useState(false);
  const bipReceived = useRef(false);

  useEffect(() => {
    if (isStandaloneDisplay() || wasInstalledLocally()) {
      setDone(true);
      return;
    }

    setIos(isIosDevice());
    setIosSafari(isIosSafari());
    setIosInApp(isIosInAppBrowser());
    void hasInstalledRelatedWebApp().then((v) => {
      setInstalledRelated(v);
      if (v) markInstalledLocally();
    });

    const onBip = (e: Event) => {
      e.preventDefault();
      bipReceived.current = true;
      setDeferred(e as BeforeInstallPromptEvent);
      if (!installDismissed()) setOpen(true);
    };

    const onInstalled = () => {
      markInstalledLocally();
      setInstalling(false);
      setDone(true);
      setDeferred(null);
      setOpen(false);
    };

    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (done || isStandaloneDisplay() || wasInstalledLocally()) {
      setOpen(false);
      return;
    }
    if (AUTH_PATHS.has(pathname)) {
      setOpen(false);
      return;
    }
    if (installDismissed() && !installedRelated) return;

    const id = window.setTimeout(() => {
      if (isStandaloneDisplay() || wasInstalledLocally()) return;
      void hasInstalledRelatedWebApp().then((installed) => {
        setInstalledRelated(installed);
        if (installed) {
          markInstalledLocally();
          setOpen(true);
          return;
        }
        if (installDismissed()) return;
        // Only auto-open when we can actually install (Chromium prompt) or iOS guide.
        if (deferred || isIosDevice()) {
          setOpen(true);
          markSessionPrompted();
        } else if (!bipReceived.current && !wasPromptedThisSession()) {
          // Soft fallback once per session if BIP is late.
          setOpen(true);
          markSessionPrompted();
        }
      });
    }, wasPromptedThisSession() ? 1200 : PROMPT_DELAY_MS);

    return () => window.clearTimeout(id);
  }, [pathname, deferred, installedRelated, done]);

  if (!open || isStandaloneDisplay() || done) return null;

  async function onInstall() {
    if (!deferred || installing) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      const choice = await Promise.race([
        deferred.userChoice,
        new Promise<{ outcome: "dismissed" }>((resolve) =>
          window.setTimeout(() => resolve({ outcome: "dismissed" }), 60_000),
        ),
      ]);
      setDeferred(null);
      if (choice.outcome === "accepted") {
        markInstalledLocally();
        setDone(true);
        setOpen(false);
      } else {
        dismissInstallPrompt();
        setOpen(false);
      }
    } catch {
      dismissInstallPrompt();
      setOpen(false);
    } finally {
      setInstalling(false);
    }
  }

  function onDismiss() {
    dismissInstallPrompt();
    setOpen(false);
  }

  const body = installedRelated
    ? "Cyber Alert est déjà installé. Ouvrez l'icône depuis l'écran d'accueil ou le menu des apps."
    : installing
      ? "Installation en cours - validez la fenêtre du navigateur…"
      : ios
        ? iosInApp
          ? "Ouvrez cette page dans Safari, puis Partager → Sur l'écran d'accueil."
          : iosSafari
            ? "Sur iPhone / iPad : Partager → Sur l'écran d'accueil. L'icône Cyber Alert apparaît ensuite."
            : "Sur iOS, utilisez Safari : Partager → Sur l'écran d'accueil."
        : deferred
          ? "Installez Cyber Alert pour un accès rapide. L'icône officielle s'affiche sur l'écran d'accueil."
          : "Menu du navigateur → Installer l'application / Ajouter à l'écran d'accueil.";

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
      <div className="mx-auto flex max-w-lg items-start gap-3 rounded-[22px] border border-[var(--ca-border)] bg-white/95 p-3.5 shadow-[0_20px_50px_-24px_rgba(12,24,48,0.55)] backdrop-blur">
        <div className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt="Cyber Alert DRC"
            width={48}
            height={48}
            className="h-12 w-12 rounded-[14px] bg-white object-contain ring-1 ring-[var(--ca-border)]"
          />
          {installing ? (
            <span className="absolute -bottom-1 -right-1 h-4 w-4 animate-spin rounded-full border-2 border-[var(--ca-accent)] border-t-transparent bg-white" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--ca-accent)]">
            {installing ? "Installation…" : "Installer l'app"}
          </p>
          <p className="mt-0.5 text-sm font-bold text-[var(--ca-ink)]">Cyber Alert DRC</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--ca-ink-muted)]">{body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!installedRelated && deferred ? (
              <Button
                type="button"
                className="!px-3 !py-2 text-sm"
                disabled={installing}
                onClick={() => void onInstall()}
              >
                {installing ? "En cours…" : "Installer"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="!px-3 !py-2 text-sm"
              disabled={installing}
              onClick={onDismiss}
            >
              Plus tard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
