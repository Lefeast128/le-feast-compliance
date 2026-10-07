import { useEffect, useState } from "react";
import { APP_VERSION } from "@/lib/app-version";
import {
  applyPwaUpdate,
  isStandaloneDisplayMode,
  registerPwa,
} from "@/pwa/register";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const IOS_GUIDANCE_DISMISSED = "le-feast-ios-install-guidance-dismissed";

function isIosBrowser() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !isStandaloneDisplayMode();
}

function hasDismissedIosGuidance() {
  try {
    return window.localStorage.getItem(IOS_GUIDANCE_DISMISSED) === "true";
  } catch {
    return false;
  }
}

export function PwaStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [updateRegistration, setUpdateRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [iosGuidance, setIosGuidance] = useState(() => {
    if (typeof window === "undefined" || !isIosBrowser()) return false;
    return !hasDismissedIosGuidance();
  });

  useEffect(() => {
    const handleOffline = () => setIsOnline(false);
    const handleOnline = () => {
      setIsOnline(true);
      window.dispatchEvent(new Event("rest:data-changed"));
    };
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    registerPwa(setUpdateRegistration);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    };
  }, []);

  const standalone = isStandaloneDisplayMode();
  const showInstall = !standalone && installPrompt !== null;
  const showIosGuidance = !standalone && iosGuidance && isIosBrowser();

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  function dismissIosGuidance() {
    try {
      window.localStorage.setItem(IOS_GUIDANCE_DISMISSED, "true");
    } catch {
      // Installation guidance remains dismissible for the current session.
    }
    setIosGuidance(false);
  }

  const notice = !isOnline ? (
    <div role="status">
      <p className="font-semibold">You&apos;re offline</p>
      <p className="text-sm text-muted-foreground">
        Reconnect to continue recording compliance checks.
      </p>
    </div>
  ) : updateRegistration ? (
    <div role="status">
      <p className="font-semibold">A new version of Le Feast Compliance is available.</p>
      <button
        type="button"
        className="mt-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        onClick={() => void applyPwaUpdate(updateRegistration)}
      >
        Update
      </button>
    </div>
  ) : showInstall ? (
    <div role="status" className="flex items-center gap-3">
      <p className="text-sm font-semibold">Install Le Feast Compliance</p>
      <button
        type="button"
        className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        onClick={() => void installApp()}
      >
        Install app
      </button>
    </div>
  ) : showIosGuidance ? (
    <div role="status">
      <p className="font-semibold">Install Le Feast Compliance</p>
      <p className="text-sm text-muted-foreground">Share → Add to Home Screen</p>
      <button
        type="button"
        className="mt-2 text-sm font-semibold underline underline-offset-2"
        onClick={dismissIosGuidance}
      >
        Dismiss
      </button>
    </div>
  ) : null;

  return (
    <>
      <span className="sr-only">Version {APP_VERSION}</span>
      {notice ? (
        <div className="fixed inset-x-0 top-0 z-[70] flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card px-4 py-3 text-card-foreground shadow-lg">
            {notice}
          </div>
        </div>
      ) : null}
    </>
  );
}
