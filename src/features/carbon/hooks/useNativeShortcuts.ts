import { useEffect } from "react";
import {
  configureNativeShortcuts,
  isTauri,
} from "../../../lib/native";
import type { Notify } from "../types";

export function useNativeShortcuts({
  captureHotkey,
  enabled,
  hydrated,
  notify,
  onReadyChange,
  showWindowHotkey,
}: {
  captureHotkey: string;
  enabled: boolean;
  hydrated: boolean;
  notify: Notify;
  onReadyChange: (ready: boolean) => void;
  showWindowHotkey: string;
}) {
  useEffect(() => {
    if (!hydrated) return;
    if (!isTauri()) {
      onReadyChange(true);
      return;
    }

    let cancelled = false;
    void configureNativeShortcuts(
      captureHotkey,
      showWindowHotkey,
      enabled,
    )
      .then((status) => {
        if (cancelled) return;
        onReadyChange(status.captureReady);
        if (status.captureError) {
          notify(`Shortcut unavailable: ${status.captureError}`, "error");
        }
        if (status.showWindowError) {
          notify(
            `Show shortcut unavailable: ${status.showWindowError}`,
            "error",
          );
        }
      })
      .catch((error) => {
        if (cancelled) return;
        onReadyChange(false);
        notify(`Shortcuts unavailable: ${String(error)}`, "error");
      });

    return () => {
      cancelled = true;
    };
  }, [
    captureHotkey,
    enabled,
    hydrated,
    notify,
    onReadyChange,
    showWindowHotkey,
  ]);
}
