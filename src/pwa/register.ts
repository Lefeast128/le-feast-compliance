export type PwaUpdateHandler = (registration: ServiceWorkerRegistration) => void;

export function isStandaloneDisplayMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function registerPwa(onUpdate: PwaUpdateHandler) {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  void navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((registration) => {
      const notifyIfWaiting = () => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          onUpdate(registration);
        }
      };

      notifyIfWaiting();
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed") notifyIfWaiting();
        });
      });

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void registration.update();
      });
    })
    .catch((error: unknown) => {
      console.warn("Unable to register the Le Feast app shell", error);
    });
}

export function applyPwaUpdate(registration: ServiceWorkerRegistration) {
  return new Promise<void>((resolve) => {
    const reload = () => {
      navigator.serviceWorker.removeEventListener("controllerchange", reload);
      window.location.reload();
      resolve();
    };

    navigator.serviceWorker.addEventListener("controllerchange", reload, {
      once: true,
    });
    registration.waiting?.postMessage({ type: "SKIP_WAITING" });
  });
}
