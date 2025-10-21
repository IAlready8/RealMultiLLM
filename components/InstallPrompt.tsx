/**
 * InstallPrompt.tsx
 *
 * 3-STEP PLAN
 * 1) Listen for SW update events and show a reload prompt. // ✅
 * 2) Support PWA install via beforeinstallprompt. // ✅
 * 3) Keep footprint minimal and framework-agnostic. // ✅
 */

"use client";

import React from "react";

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = React.useState<any>(null);
  const [updateAvailable, setUpdateAvailable] = React.useState(false);

  React.useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setInstallEvent(e as any);
    }
    function onUpdate() {
      setUpdateAvailable(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
    document.addEventListener("sw:update-available", onUpdate as any);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
      document.removeEventListener("sw:update-available", onUpdate as any);
    };
  }, []);

  if (!installEvent && !updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-xl flex gap-2 items-center">
      {installEvent && (
        <button
          className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded"
          onClick={async () => {
            const e = installEvent as any;
            e.prompt();
            const choice = await e.userChoice;
            if (choice.outcome !== "accepted") {
              // user dismissed
            }
            setInstallEvent(null);
          }}
        >
          Install App
        </button>
      )}
      {updateAvailable && (
        <button
          className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1 rounded"
          onClick={() => location.reload()}
        >
          Update Available — Reload
        </button>
      )}
    </div>
  );
}