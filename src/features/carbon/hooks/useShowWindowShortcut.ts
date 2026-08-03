import {
  register,
  unregister,
} from "@tauri-apps/plugin-global-shortcut";
import { useCallback, useEffect } from "react";
import { isTauri, showMainWindow } from "../../../lib/native";
import { doublePressModifier } from "../../../lib/utils";
import type { Notify } from "../types";

export function useShowWindowShortcut({
  enabled,
  hotkey,
  hydrated,
  notify,
}: {
  enabled: boolean;
  hotkey: string;
  hydrated: boolean;
  notify: Notify;
}) {
  const showWindow = useCallback(() => {
    if (!enabled) return Promise.resolve();
    return showMainWindow();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !hydrated || !isTauri() || doublePressModifier(hotkey)) {
      return;
    }
    let cancelled = false;

    async function setupHotkey() {
      await unregister(hotkey).catch(() => undefined);
      await register(hotkey, async (event) => {
        if (event.state !== "Pressed" || cancelled) return;
        await showWindow();
      });
    }

    void setupHotkey().catch((error) =>
      notify(`Show shortcut unavailable: ${String(error)}`, "error"),
    );
    return () => {
      cancelled = true;
      void unregister(hotkey).catch(() => undefined);
    };
  }, [enabled, hotkey, hydrated, notify, showWindow]);
}
