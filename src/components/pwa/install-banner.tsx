"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";
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
const PROMPT_DELAY_MS = 1800;

const AUTH_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]);

export function PwaInstallBanner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [ios, setIos] = useState(false);
  const [iosSafari, setIosSafari] = useState(false);
  const [iosInApp, setIosInApp] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installedRelated, setInstalledRelated] = useState(false);
  const bipReceived = useRef(false);

  useEffect(() => {
    if (isStandaloneDisplay()) return;
    setIos(isIosDevice());
    setIosSafari(isIosSafari());
    setIosInApp(isIosInAppBrowser());
    void hasInstalledRelatedWebApp().then(setInstalledRelated);

    const onBip = (e: Event) => {
      e.preventDefault();
      bipReceived.current = true;
      setDeferred(e as BeforeInstallPromptEvent);
      if (!installDismissed()) setOpen(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  useEffect(() => {
    if (isStandaloneDisplay()) {
      setOpen(false);
      return;
    }
    if (AUTH_PATHS.has(pathname)) {
      setOpen(false);
      return;
    }
    if (installDismissed() && !installedRelated) return;

    const id = window.setTimeout(() => {
      if (isStandaloneDisplay()) return;
      void hasInstalledRelatedWebApp().then((installed) => {
        setInstalledRelated(installed);
        if (installed) {
          setOpen(true);
          return;
        }
        if (installDismissed()) return;
        if (deferred || isIosDevice() || !bipReceived.current) {
          setOpen(true);
          markSessionPrompted();
        }
      });
    }, wasPromptedThisSession() ? 900 : PROMPT_DELAY_MS);

    return () => window.clearTimeout(id);
  }, [pathname, deferred, installedRelated]);

  if (!open || isStandaloneDisplay()) return null;

  async function onInstall() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === "accepted") {
      setOpen(false);
    } else {
      dismissInstallPrompt();
      setOpen(false);
    }
  }

  function onDismiss() {
    dismissInstallPrompt();
    setOpen(false);
  }

  const body = installedRelated
    ? "Cyber Alert est déjà installé sur cet appareil. Ouvrez-le depuis l'écran d'accueil."
    : ios
      ? iosInApp
        ? "Ouvrez cette page dans Safari, puis Partager → Sur l'écran d'accueil."
        : iosSafari
          ? "Sur iPhone : Partager → Sur l'écran d'accueil pour installer Cyber Alert."
          : "Sur iOS, utilisez Safari : Partager → Sur l'écran d'accueil."
      : deferred
        ? "Installez Cyber Alert DRC pour vérifier les liens plus vite, hors navigateur."
        : "Ajoutez Cyber Alert à l'écran d'accueil depuis le menu du navigateur.";

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
      <div className="mx-auto flex max-w-lg items-start gap-3 rounded-[22px] border border-[var(--ca-border)] bg-white/95 p-3.5 shadow-[0_20px_50px_-24px_rgba(12,24,48,0.55)] backdrop-blur">
        <BrandLogo size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--ca-accent)]">
            Installer l&apos;app
          </p>
          <p className="mt-0.5 text-sm font-bold text-[var(--ca-ink)]">Cyber Alert DRC</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--ca-ink-muted)]">{body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!installedRelated && deferred ? (
              <Button type="button" className="!px-3 !py-2 text-sm" onClick={() => void onInstall()}>
                Installer
              </Button>
            ) : null}
            <Button type="button" variant="ghost" className="!px-3 !py-2 text-sm" onClick={onDismiss}>
              Plus tard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
