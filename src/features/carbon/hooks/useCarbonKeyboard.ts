import { useEffect, type RefObject } from "react";
import type { CarbonItem, CarbonSection } from "../../../lib/model";
import { isEditableTarget } from "../../../lib/utils";

export function useCarbonKeyboard({
  allVisibleItems,
  clearSelected,
  copySelectedItems,
  deleteItems,
  focusedItemId,
  searchRef,
  sections,
  selectedIds,
  setCommandOpen,
  setContextMenu,
  setFocusedItemId,
  setPasteMenu,
  setSelected,
  setSettingsOpen,
  startEditing,
  toggleItems,
}: {
  allVisibleItems: CarbonItem[];
  clearSelected: () => void;
  copySelectedItems: () => unknown;
  deleteItems: () => void;
  focusedItemId: string | null;
  searchRef: RefObject<HTMLInputElement | null>;
  sections: CarbonSection[];
  selectedIds: string[];
  setCommandOpen: (open: boolean) => void;
  setContextMenu: (state: null) => void;
  setFocusedItemId: (id: string | null) => void;
  setPasteMenu: (state: null) => void;
  setSelected: (ids: string[]) => void;
  setSettingsOpen: (open: boolean) => void;
  startEditing: (item: CarbonItem) => void;
  toggleItems: (ids: string[]) => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (modifier && event.key === ",") {
        event.preventDefault();
        setSettingsOpen(true);
        return;
      }
      if (modifier && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (modifier && event.key.toLowerCase() === "c" && selectedIds.length) {
        event.preventDefault();
        void copySelectedItems();
        return;
      }
      if (isEditableTarget(event.target)) return;
      if (modifier && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setFocusedItemId(null);
        setSelected(allVisibleItems.map((item) => item.id));
      } else if (event.key === "Delete" && selectedIds.length) {
        event.preventDefault();
        deleteItems();
      } else if (event.key === " " && selectedIds.length) {
        event.preventDefault();
        toggleItems(selectedIds);
      } else if (event.key === "Enter" && focusedItemId) {
        const item = sections
          .flatMap((section) => section.items)
          .find((candidate) => candidate.id === focusedItemId);
        if (item) {
          event.preventDefault();
          startEditing(item);
          clearSelected();
        }
      } else if (event.key === "Escape") {
        clearSelected();
        setFocusedItemId(null);
        setContextMenu(null);
        setPasteMenu(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    allVisibleItems,
    clearSelected,
    copySelectedItems,
    deleteItems,
    focusedItemId,
    searchRef,
    sections,
    selectedIds,
    setCommandOpen,
    setContextMenu,
    setFocusedItemId,
    setPasteMenu,
    setSelected,
    setSettingsOpen,
    startEditing,
    toggleItems,
  ]);
}
