import { useEffect, useMemo, useState, type MouseEvent } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import type { CarbonSection } from "../../../lib/model";
import type { ContextMenuState } from "../types";

type PasteMenuState = { x: number; y: number } | null;

export function useCarbonContextMenus({
  clearSelected,
  reorderItem,
  sections,
  selectedIds,
  setFocusedItemId,
}: {
  clearSelected: () => void;
  reorderItem: (sectionId: string, activeId: string, overId: string) => void;
  sections: CarbonSection[];
  selectedIds: string[];
  setFocusedItemId: (id: string | null) => void;
}) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [pasteMenu, setPasteMenu] = useState<PasteMenuState>(null);

  useEffect(() => {
    if (!contextMenu && !pasteMenu) return;
    const close = () => {
      setContextMenu(null);
      setPasteMenu(null);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
    };
  }, [contextMenu, pasteMenu]);

  const contextItem = useMemo(
    () =>
      contextMenu
        ? sections
            .flatMap((section) => section.items)
            .find((item) => item.id === contextMenu.itemId)
        : undefined,
    [contextMenu, sections],
  );
  const contextSelectedItems = useMemo(() => {
    if (!contextMenu) return [];
    const selection = new Set(contextMenu.itemIds);
    return sections.flatMap((section) =>
      section.items.filter((item) => selection.has(item.id)),
    );
  }, [contextMenu, sections]);

  function openContextMenu(event: MouseEvent, itemId: string) {
    event.preventDefault();
    setPasteMenu(null);
    if (!selectedIds.includes(itemId)) {
      clearSelected();
      setFocusedItemId(itemId);
    }
    setContextMenu({
      x: Math.min(event.clientX, window.innerWidth - 220),
      y: Math.min(event.clientY, window.innerHeight - 320),
      itemId,
      itemIds: selectedIds.includes(itemId) ? [...selectedIds] : [itemId],
    });
  }

  function openPasteMenu(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (
      target.closest(
        "button, input, textarea, label, a, [role], [data-note-card]",
      )
    ) {
      return;
    }
    event.preventDefault();
    setContextMenu(null);
    setPasteMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 188)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 56)),
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;
    const section = sections.find((candidate) =>
      candidate.items.some((item) => item.id === activeId),
    );
    if (
      section?.sortMode === "manual" &&
      section.items.some((item) => item.id === overId)
    ) {
      reorderItem(section.id, activeId, overId);
    }
  }

  return {
    contextItem,
    contextMenu,
    contextSelectedItems,
    handleDragEnd,
    openContextMenu,
    openPasteMenu,
    pasteMenu,
    setContextMenu,
    setPasteMenu,
  };
}
