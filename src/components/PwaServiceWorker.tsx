"use client";

import { useEffect } from "react";

export default function PwaServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
      registration.update().catch(() => undefined);
    }).catch(() => undefined);
  }, []);

  return null;
}
