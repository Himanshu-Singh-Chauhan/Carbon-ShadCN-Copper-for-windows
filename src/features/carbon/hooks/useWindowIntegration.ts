import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import type { CarbonSettings, WindowBounds } from "../../../lib/model";
import { isTauri } from "../../../lib/native";
import { useCarbonStore } from "../../../lib/store";
import type { Notify } from "../types";

const MIN_WINDOW_WIDTH = 320;
const MIN_WINDOW_HEIGHT = 500;
const WINDOWS_MINIMIZED_COORDINATE = -10_000;

function isUsableWindowBounds(
  bounds: WindowBounds | undefined,
): bounds is WindowBounds {
  return Boolean(
    bounds &&
      bounds.width >= MIN_WINDOW_WIDTH &&
      bounds.height >= MIN_WINDOW_HEIGHT &&
      bounds.x > WINDOWS_MINIMIZED_COORDINATE &&
      bounds.y > WINDOWS_MINIMIZED_COORDINATE,
  );
}

export function useWindowIntegration({
  hydrated,
  settings,
  updateSettings,
  notify,
}: {
  hydrated: boolean;
  settings: CarbonSettings;
  updateSettings: ReturnType<typeof useCarbonStore.getState>["updateSettings"];
  notify: Notify;
}) {
  useEffect(() => {
    if (!hydrated || !isTauri()) return;
    void getCurrentWindow()
      .setAlwaysOnTop(settings.alwaysOnTop)
      .catch(() => undefined);
  }, [hydrated, settings.alwaysOnTop]);

  useEffect(() => {
    if (!isTauri()) return;
    let cleanup: (() => void) | undefined;
    void listen<boolean>("always-on-top-changed", ({ payload }) => {
      updateSettings({ alwaysOnTop: payload });
    }).then((unlisten) => {
      cleanup = unlisten;
    });
    return () => cleanup?.();
  }, [updateSettings]);

  useEffect(() => {
    if (!hydrated || !isTauri()) return;
    const cleanups: (() => void)[] = [];
    const appWindow = getCurrentWindow();

    async function setupWindow() {
      if (isUsableWindowBounds(settings.windowBounds)) {
        const { x, y, width, height } = settings.windowBounds;
        await appWindow.setPosition(new PhysicalPosition(x, y));
        await appWindow.setSize(new PhysicalSize(width, height));
      } else if (settings.windowBounds) {
        updateSettings({ windowBounds: undefined });
      }
      cleanups.push(
        await appWindow.onCloseRequested((event) => {
          event.preventDefault();
          void appWindow.hide();
        }),
      );
      cleanups.push(
        await appWindow.onMoved(({ payload }) => {
          if (
            payload.x <= WINDOWS_MINIMIZED_COORDINATE ||
            payload.y <= WINDOWS_MINIMIZED_COORDINATE
          ) {
            return;
          }
          const current = useCarbonStore.getState().settings.windowBounds;
          updateSettings({
            windowBounds: {
              x: payload.x,
              y: payload.y,
              width: current?.width ?? 390,
              height: current?.height ?? 720,
            },
          });
        }),
      );
      cleanups.push(
        await appWindow.onResized(({ payload }) => {
          if (
            payload.width < MIN_WINDOW_WIDTH ||
            payload.height < MIN_WINDOW_HEIGHT
          ) {
            return;
          }
          const current = useCarbonStore.getState().settings.windowBounds;
          updateSettings({
            windowBounds: {
              x: current?.x ?? 80,
              y: current?.y ?? 80,
              width: payload.width,
              height: payload.height,
            },
          });
        }),
      );
    }

    void setupWindow().catch((error) =>
      notify(`Window preferences were not restored: ${String(error)}`, "error"),
    );
    return () => cleanups.forEach((cleanup) => cleanup());
    // Bounds are intentionally restored only once after hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !isTauri()) return;
    let cleanup: (() => void) | undefined;
    void listen<{ itemId: string; bucketId: string }>(
      "captured-item-bucket-changed",
      ({ payload }) => {
        useCarbonStore
          .getState()
          .moveItems([payload.itemId], payload.bucketId);
      },
    ).then((unlisten) => {
      cleanup = unlisten;
    });
    return () => cleanup?.();
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !isTauri()) return;
    let cleanup: (() => void) | undefined;
    void listen<{ itemId: string; attachmentId: string }>(
      "image-viewer-attachment-trashed",
      ({ payload }) => {
        const state = useCarbonStore.getState();
        const item = state.sections
          .flatMap((section) => section.items)
          .find((candidate) => candidate.id === payload.itemId);
        if (!item) return;
        const attachments = item.attachments.filter(
          (attachment) => attachment.id !== payload.attachmentId,
        );
        if (!item.text.trim() && attachments.length === 0) {
          state.deleteItems([item.id]);
        } else {
          state.updateItem(item.id, item.text, attachments);
        }
      },
    ).then((unlisten) => {
      cleanup = unlisten;
    });
    return () => cleanup?.();
  }, [hydrated]);
}
