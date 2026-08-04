import { listen } from "@tauri-apps/api/event";
import {
  register,
  unregister,
} from "@tauri-apps/plugin-global-shortcut";
import { useCallback, useEffect, useRef } from "react";
import { captureSelectedText, isTauri } from "../../../lib/native";
import { useCarbonStore } from "../../../lib/store";
import { doublePressModifier } from "../../../lib/utils";
import {
  showAddedItemNotification,
  showCaptureStatusNotification,
} from "../capture-notification";
import type { Notify } from "../types";

export function useCaptureShortcut({
  hydrated,
  enabled,
  hotkey,
  notify,
  onReadyChange,
}: {
  hydrated: boolean;
  enabled: boolean;
  hotkey: string;
  notify: Notify;
  onReadyChange: (ready: boolean) => void;
}) {
  const captureInFlight = useRef(false);

  const capture = useCallback(async () => {
    if (!enabled || captureInFlight.current) return;
    captureInFlight.current = true;
    try {
      const captured = await captureSelectedText();
      const text = captured.text.trim();
      if (!text) {
        await showCaptureStatusNotification("No selection").catch(
          () => undefined,
        );
        return;
      }
      const added = useCarbonStore
        .getState()
        .addItem(text, undefined, undefined, captured.source);
      void showAddedItemNotification(added, "Captured to Carbon").catch(
        () => undefined,
      );
    } catch (error) {
      const message = String(error);
      void showCaptureStatusNotification(
        message.includes("Editor: Accessibility Support")
          ? "VS Code needs Accessibility Support enabled"
          : "Couldn’t read this app’s selection",
        "error",
      ).catch(() => undefined);
    } finally {
      captureInFlight.current = false;
    }
  }, [enabled]);

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
