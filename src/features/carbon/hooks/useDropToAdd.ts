import { useCallback, useState, type DragEvent } from "react";
import type { AddedItem } from "../../../lib/store";
import { useCarbonStore } from "../../../lib/store";
import { isEditableTarget } from "../../../lib/utils";
import { resolveDroppedContent, supportsDrop } from "../drop";
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

  const onDragEnter = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!enabled || !supportsDrop(event.dataTransfer)) return;
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
    setDropActive(false);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
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
          const attachments = await Promise.all(
            dropped.images.map((file) => saveImageFile(file)),
          );
          const added = addItem(dropped.text, undefined, attachments);
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
