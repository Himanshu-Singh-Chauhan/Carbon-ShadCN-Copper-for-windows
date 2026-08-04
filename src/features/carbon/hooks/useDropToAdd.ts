import { useCallback, useRef, useState, type DragEvent } from "react";
import type { AddedItem } from "../../../lib/store";
import { useCarbonStore } from "../../../lib/store";
import { isEditableTarget } from "../../../lib/utils";
import { resolveDroppedContent, supportsDrop } from "../drop";
import {
  getRememberedSource,
  rememberForegroundSource,
} from "../externalInputSource";
import { saveImageFile } from "../clipboard";
import type { Notify } from "../types";

function keepsNativeDropBehavior(target: EventTarget | null) {
  return (
    isEditableTarget(target) ||
    (target instanceof Element &&
      Boolean(target.closest("[data-composer-drop-zone]")))
  );
}

export function useDropToAdd({
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
  const [dropActive, setDropActive] = useState(false);
  const sourceRequestedForDrag = useRef(false);

  const onDragEnter = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!enabled || !supportsDrop(event.dataTransfer)) return;
      if (!sourceRequestedForDrag.current) {
        sourceRequestedForDrag.current = true;
        void rememberForegroundSource();
      }
      if (keepsNativeDropBehavior(event.target)) {
        setDropActive(false);
        return;
      }
      event.preventDefault();
      setDropActive(true);
    },
    [enabled],
  );

  const onDragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!enabled || !supportsDrop(event.dataTransfer)) return;
      if (keepsNativeDropBehavior(event.target)) {
        setDropActive(false);
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setDropActive(true);
    },
    [enabled],
  );

  const onDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    sourceRequestedForDrag.current = false;
    setDropActive(false);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      sourceRequestedForDrag.current = false;
      setDropActive(false);
      if (
        !enabled ||
        keepsNativeDropBehavior(event.target) ||
        !supportsDrop(event.dataTransfer)
      ) {
        return;
      }

      event.preventDefault();
      void (async () => {
        try {
          const dropped = await resolveDroppedContent(event.dataTransfer);
          if (
            dropped.unsupportedFiles ||
            (!dropped.text && dropped.images.length === 0)
          ) {
            notify(
              "That drop doesn’t contain text or a supported image.",
              "error",
            );
            return;
          }
          const pageUrl = dropped.images.find((image) => image.pageUrl)?.pageUrl;
          const source = await getRememberedSource(pageUrl);
          const attachments = await Promise.all(
            dropped.images.map((image) =>
              saveImageFile(image.file, undefined, {
                sourceUrl: image.sourceUrl,
                pageUrl: image.pageUrl ?? source?.pageUrl,
              }),
            ),
          );
          const added = addItem(
            dropped.text,
            undefined,
            attachments,
            source,
          );
          if (added) onItemAdded(added);
        } catch (error) {
          notify(`Couldn’t add the dropped item: ${String(error)}`, "error");
        }
      })();
    },
    [addItem, enabled, notify, onItemAdded],
  );

  return {
    dropActive,
    dropHandlers: {
      onDragEnter,
      onDragLeave,
      onDragOver,
      onDrop,
    },
  };
}
