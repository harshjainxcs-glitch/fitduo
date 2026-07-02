"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Bell, X } from "lucide-react";
import {
  enablePush,
  pushSupported,
  registerServiceWorker,
} from "@/lib/push/client";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "fitduo-push-dismissed";
const emptySubscribe = () => () => {};

function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

function isIosNonStandalone() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari-only
    navigator.standalone === true;
  return ios && !standalone;
}

// Registers the service worker and, once per device, offers to enable reminders.
export function PushManager() {
  const isClient = useIsClient();
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  if (!isClient || hidden) return null;
  if (!pushSupported()) return null;
  if (Notification.permission !== "default") return null;
  if (localStorage.getItem(DISMISS_KEY) === "1") return null;

  const iosHint = isIosNonStandalone();

  async function onEnable() {
    setBusy(true);
    try {
      await enablePush();
      toast.success("Reminders enabled 🔔");
      setHidden(true);
    } catch (e) {
      const m = (e as Error).message;
      if (m === "denied")
        toast.error("Notifications are blocked — enable them in browser settings.");
      else if (m === "unsupported")
        toast.error("Push isn't supported on this browser.");
      else toast.error("Couldn't enable reminders.");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  }

  return (
    <div className="mx-4 mb-2 flex items-start gap-3 rounded-xl border bg-card p-3">
      <Bell className="mt-0.5 size-5 shrink-0 text-amber-500" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Enable reminders</p>
        <p className="text-xs text-muted-foreground">
          Get water &amp; meal nudges through the day.
          {iosHint
            ? " On iPhone, add FitDuo to your Home Screen first."
            : ""}
        </p>
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={onEnable} disabled={busy}>
            {busy ? "Enabling…" : "Enable"}
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            Not now
          </Button>
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="text-muted-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
