"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function PwaInstaller() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
      registration.update().catch(() => undefined);
    }).catch(() => undefined);

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => setInstallPrompt(null);

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (!installPrompt || dismissed) return null;

  const install = async () => {
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return (
    <aside
      aria-label="Install website application"
      className="fixed bottom-4 right-4 z-[120] w-[min(22rem,calc(100vw-2rem))] border border-[#00ff66]/45 bg-[#000a06]/[0.98] shadow-[0_0_28px_rgba(0,255,102,0.16)]"
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#00ff66]/35 bg-[#00ff66]/10 text-[#00ff66]">
          <Download size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold uppercase text-white">Install 101st Doom</p>
          <p className="mt-1 text-xs leading-5 text-[#8aa99a]">
            Add the battalion website to this device for app-style access.
          </p>
          <button
            type="button"
            onClick={install}
            className="mt-3 border border-[#00ff66] bg-[#00ff66] px-4 py-2 text-xs font-bold uppercase text-black transition-colors hover:bg-[#8dffb9]"
          >
            Install app
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss install prompt"
          title="Dismiss"
          className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#00ff66]/20 text-[#6f8c7d] transition-colors hover:border-[#00ff66]/60 hover:text-white"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
