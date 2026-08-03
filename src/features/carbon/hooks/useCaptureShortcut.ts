import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  register,
  unregister,
} from "@tauri-apps/plugin-global-shortcut";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import { captureSelectedText, isTauri } from "../../../lib/native";
import { useCarbonStore } from "../../../lib/store";
import { doublePressModifier } from "../../../lib/utils";
import { showAddedItemNotification } from "../capture-notification";
import type { Notify } from "../types";

export function useCaptureShortcut({
  hydrated,
  enabled,
  hotkey,
  inputRef,
  notify,
  onReadyChange,
}: {
  hydrated: boolean;
  enabled: boolean;
  hotkey: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  notify: Notify;
  onReadyChange: (ready: boolean) => void;
}) {
  const captureInFlight = useRef(false);

  const capture = useCallback(async () => {
    if (!enabled || captureInFlight.current) return;
    captureInFlight.current = true;
    try {
      const text = (await captureSelectedText()).trim();
      if (!text) {
        await getCurrentWindow().show();
        await getCurrentWindow().setFocus();
        notify("Nothing was selected. Type a note instead.");
        inputRef.current?.focus();
        return;
      }
      const added = useCarbonStore.getState().addItem(text);
      void showAddedItemNotification(added, "Captured to Carbon").catch(
        () => undefined,
      );
    } catch {
      await getCurrentWindow().show();
      await getCurrentWindow().setFocus();
      notify(
        "Carbon couldn’t read this app’s selection. Clipboard untouched.",
        "error",
      );
    } finally {
      captureInFlight.current = false;
    }
  }, [enabled, inputRef, notify]);

  useEffect(() => {
    if (!hydrated || !isTauri()) return;
    let cleanup: (() => void) | undefined;
    void listen("double-shortcut-capture", () => void capture()).then(
      (unlisten) => {
        cleanup = unlisten;
      },
    );
    return () => cleanup?.();
  }, [capture, hydrated]);

  useEffect(() => {
    if (!hydrated || !enabled || !isTauri()) return;
    let cancelled = false;
    onReadyChange(true);
    if (doublePressModifier(hotkey)) return;

    async function setupHotkey() {
      await unregister(hotkey).catch(() => undefined);
      await register(hotkey, async (event) => {
        if (event.state !== "Pressed" || cancelled) return;
        await capture();
      });
    }

    void setupHotkey().catch((error) => {
      onReadyChange(false);
      notify(`Shortcut unavailable: ${String(error)}`, "error");
    });
    return () => {
      cancelled = true;
      void unregister(hotkey).catch(() => undefined);
    };
  }, [capture, enabled, hotkey, hydrated, notify, onReadyChange]);
}
