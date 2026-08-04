import { useCallback, useEffect, useRef } from "react";
import type { AddedItem } from "../../../lib/store";
import type { CarbonImageOrigin } from "../../../lib/model";
import { useCarbonStore } from "../../../lib/store";
import { isEditableTarget } from "../../../lib/utils";
import {
  readSystemClipboard,
  saveImageFile,
} from "../clipboard";
import {
  imageOriginFromTransfer,
  requestsImageDrop,
  resolveDroppedContent,
} from "../drop";
import { getRememberedSource } from "../externalInputSource";
import type { Notify } from "../types";

export function useFlexiblePaste({
  addItem,
  enabled,
  notify,
  onItemAdded,
}: {
  addItem: ReturnType<typeof useCarbonStore.getState>["addItem"];
  enabled: boolean;
  notify: Notify;
  onItemAdded: (added: AddedItem) => void;
}) {
  const pasteInFlight = useRef(false);

  const addClipboardItem = useCallback(
    async (
      rawText: string,
      imageFiles: File[],
      imageOrigin: CarbonImageOrigin = {},
    ) => {
      const text = rawText.trim();
      if ((!text && imageFiles.length === 0) || pasteInFlight.current) {
        return false;
      }

      pasteInFlight.current = true;
      try {
        const source = await getRememberedSource(imageOrigin.pageUrl);
        const attachments = await Promise.all(
          imageFiles.map((file) =>
            saveImageFile(file, undefined, {
              ...imageOrigin,
              pageUrl: imageOrigin.pageUrl ?? source?.pageUrl,
            }),
          ),
        );
        const added = addItem(text, undefined, attachments, source);
        if (added) onItemAdded(added);
        return Boolean(added);
      } catch (error) {
        notify(`Couldn’t paste this item: ${String(error)}`, "error");
        return false;
      } finally {
        pasteInFlight.current = false;
      }
    },
    [addItem, notify, onItemAdded],
  );

  useEffect(() => {
    if (!enabled) return;

    function handlePaste(event: ClipboardEvent) {
      if (!event.clipboardData || isEditableTarget(event.target)) return;
      const text = event.clipboardData.getData("text/plain");
      const imageRequested = requestsImageDrop(event.clipboardData);
      if (!text.trim() && !imageRequested) return;
      event.preventDefault();
      const imageOrigin = imageOriginFromTransfer(event.clipboardData);
      void resolveDroppedContent(event.clipboardData)
        .then((dropped) =>
          addClipboardItem(
            dropped.text,
            dropped.images.map((image) => image.file),
            dropped.images[0] ?? imageOrigin,
          ),
        )
        .catch((error) =>
          notify(`Couldn’t paste this item: ${String(error)}`, "error"),
        );
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [addClipboardItem, enabled, notify]);

  return useCallback(async () => {
    try {
      const clipboard = await readSystemClipboard();
      const added = await addClipboardItem(
        clipboard.text,
        clipboard.images,
        clipboard.imageOrigin,
      );
      if (!added && !clipboard.text.trim() && clipboard.images.length === 0) {
        notify("The clipboard has no text or image.", "error");
      }
    } catch (error) {
      notify(`Couldn’t read the clipboard: ${String(error)}`, "error");
    }
  }, [addClipboardItem, notify]);
}
