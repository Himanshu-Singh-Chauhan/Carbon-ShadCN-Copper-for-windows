import { useCallback, useEffect, useRef } from "react";
import type { AddedItem } from "../../../lib/store";
import { useCarbonStore } from "../../../lib/store";
import { isEditableTarget } from "../../../lib/utils";
import {
  imageFilesFromClipboard,
  readSystemClipboard,
  saveImageFile,
} from "../clipboard";
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
    async (rawText: string, imageFiles: File[]) => {
      const text = rawText.trim();
      if ((!text && imageFiles.length === 0) || pasteInFlight.current) {
        return false;
      }

      pasteInFlight.current = true;
      try {
        const attachments = await Promise.all(
          imageFiles.map((file) => saveImageFile(file)),
        );
        const added = addItem(text, undefined, attachments);
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
      const images = imageFilesFromClipboard(event.clipboardData);
      if (!text.trim() && images.length === 0) return;
      event.preventDefault();
      void addClipboardItem(text, images);
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [addClipboardItem, enabled]);

  return useCallback(async () => {
    try {
      const clipboard = await readSystemClipboard();
      const added = await addClipboardItem(clipboard.text, clipboard.images);
      if (!added && !clipboard.text.trim() && clipboard.images.length === 0) {
        notify("The clipboard has no text or image.", "error");
      }
    } catch (error) {
      notify(`Couldn’t read the clipboard: ${String(error)}`, "error");
    }
  }, [addClipboardItem, notify]);
}
