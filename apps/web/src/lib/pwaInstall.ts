import { useCallback, useEffect, useState } from "react";

const DISMISS_KEY = "kazhutha:addToHomeDismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

/** Coarse phone/tablet portrait detection — not for desktop browsers. */
export function isMobileLikeDevice(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 900px)").matches;
  return coarse && narrow;
}

export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isIpadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isAppleMobile || isIpadOs;
}

export function getAddToHomeDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

export function storeAddToHomeDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, "true");
  } catch {
    /* ignore quota / private mode */
  }
}

export function useAddToHomeScreen() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => getAddToHomeDismissed());

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = useCallback(() => {
    storeAddToHomeDismissed();
    setDismissed(true);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") {
      storeAddToHomeDismissed();
      setDismissed(true);
    }
  }, [deferredPrompt]);

  const mobileWeb = isMobileLikeDevice() && !isStandalonePwa();
  const canShow = !dismissed && mobileWeb;

  return {
    canShow,
    canNativeInstall: deferredPrompt !== null,
    showIosHint: isIosSafari(),
    showGenericHint: mobileWeb && !isIosSafari() && deferredPrompt === null,
    dismiss,
    promptInstall,
  };
}
