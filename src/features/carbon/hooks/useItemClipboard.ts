import { useCallback, useRef, useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { CarbonItem, CarbonSection } from "../../../lib/model";
import {
  copyItemsToClipboardHistory,
  isTauri,
} from "../../../lib/native";
import { useCarbonStore } from "../../../lib/store";
import type { ToastMessage } from "../types";

function itemsForIds(sections: CarbonSection[], ids: string[]) {
  const selection = new Set(ids);
  return sections.flatMap((section) =>
    section.items.filter((item) => selection.has(item.id)),
  );
}

export function useItemClipboard({
  notify,
  sections,
  selectedIds,
  setToasts,
  sourceSections,
  toastId,
}: {
  notify: (message: string, kind?: ToastMessage["kind"]) => void;
  sections: CarbonSection[];
  selectedIds: string[];
  setToasts: React.Dispatch<React.SetStateAction<ToastMessage[]>>;
  sourceSections: CarbonSection[];
  toastId: React.MutableRefObject<number>;
}) {
  const copyInFlight = useRef(false);
  const [copyingItems, setCopyingItems] = useState(false);

  const copyItems = useCallback(
    async (items: CarbonItem[], asList = false) => {
      if (!items.length || copyInFlight.current) return;
      const images = items.flatMap((item) => item.attachments);
      const texts = asList
        ? [
            items
              .filter((item) => item.text)
              .map((item) => `- ${item.text.replace(/\n/g, "\n  ")}`)
              .join("\n"),
          ].filter(Boolean)
        : items.map((item) => item.text).filter(Boolean);
      const entryCount = images.length + texts.length;
      if (!entryCount) return;

      const statusId = ++toastId.current;
      copyInFlight.current = true;
      setCopyingItems(true);
      setToasts((current) => [
        ...current.slice(-2),
        {
          id: statusId,
          message: `Copying ${entryCount} clipboard ${entryCount === 1 ? "entry" : "entries"}…`,
          kind: "loading",
        },
      ]);

      const finishStatus = (
        message: string,
        kind: ToastMessage["kind"] = "default",
      ) => {
        setToasts((current) =>
          current.map((toast) =>
            toast.id === statusId ? { ...toast, message, kind } : toast,
          ),
        );
        window.setTimeout(
          () =>
            setToasts((current) =>
              current.filter((toast) => toast.id !== statusId),
            ),
          2600,
        );
      };

      try {
        await copyItemsToClipboardHistory(images, texts);
        finishStatus(
          `Copied ${entryCount} clipboard ${entryCount === 1 ? "entry" : "entries"}`,
        );
      } catch {
        finishStatus("Clipboard access was unavailable.", "error");
      } finally {
        copyInFlight.current = false;
        setCopyingItems(false);
      }
    },
    [setToasts, toastId],
  );

  const copySelectedItems = useCallback(
    (asList = false) => {
      const state = useCarbonStore.getState();
      return copyItems(itemsForIds(state.sections, state.selectedIds), asList);
    },
    [copyItems],
  );

  const copyMarkdown = useCallback(async () => {
    const content = sourceSections
      .map(
        (section) =>
          `# ${section.name}\n\n${section.items
            .map((item) => `- [${item.completed ? "x" : " "}] ${item.text}`)
            .join("\n")}`,
      )
      .join("\n\n");
    if (!content.trim()) {
      notify("There is nothing to export.");
      return;
    }
    if (isTauri()) await writeText(content);
    else await navigator.clipboard.writeText(content);
    notify("Markdown copied to clipboard");
  }, [notify, sourceSections]);

  return {
    copyItems,
    copyMarkdown,
    copySelectedItems,
    copyingItems,
    selectedItems: itemsForIds(sections, selectedIds),
  };
}
