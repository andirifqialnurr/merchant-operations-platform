"use client";

import { useEffect } from "react";

const SERVICE_WORKER_PATH = "/sw.js";

function canRegisterServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return false;
  }

  return window.location.protocol === "https:" || window.location.hostname === "localhost";
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!canRegisterServiceWorker()) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
        await registration.update();
      } catch {
        // Registration is progressive enhancement; the app shell must still render normally.
      }
    };

    if (document.readyState === "complete") {
      void registerServiceWorker();
      return;
    }

    window.addEventListener("load", registerServiceWorker, { once: true });

    return () => {
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  return null;
}
