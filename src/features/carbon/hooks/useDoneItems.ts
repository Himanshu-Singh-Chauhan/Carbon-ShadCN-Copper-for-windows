import { useCallback } from "react";
import type { CarbonItem } from "../../../lib/model";
import { useCarbonStore } from "../../../lib/store";
import type { Notify } from "../types";

export function useDoneItems({
  clearSelected,
  notify,
  notifyWithAction,
  setFocusedItemId,
  setItemsCompleted,
}: {
  clearSelected: () => void;
  notify: Notify;
  notifyWithAction: (
    message: string,
    label: string,
    onClick: () => void,
  ) => void;
  setFocusedItemId: (id: string | null) => void;
  setItemsCompleted: (ids: string[], completed: boolean) => void;
}) {
  const setDoneState = useCallback(
    (items: CarbonItem[], completed?: boolean) => {
      if (items.length === 0) return;
      const nextCompleted =
        completed ?? items.some((item) => !item.completed);
      const ids = items.map((item) => item.id);
      setItemsCompleted(ids, nextCompleted);
      clearSelected();
      setFocusedItemId(null);

      if (nextCompleted) {
        notifyWithAction(
          items.length === 1
            ? "Moved to Done"
            : `Moved ${items.length} items to Done`,
          "Undo",
          () => {
            setItemsCompleted(ids, false);
            notify(items.length === 1 ? "Restored item" : "Restored items");
          },
        );
      } else {
        notify(items.length === 1 ? "Restored item" : "Restored items");
      }
    },
    [
      clearSelected,
      notify,
      notifyWithAction,
      setFocusedItemId,
      setItemsCompleted,
    ],
  );

  const setDoneStateForIds = useCallback(
    (ids: string[]) => {
      const selectedIds = new Set(ids);
      const selected = useCarbonStore
        .getState()
        .sections.flatMap((section) => section.items)
        .filter((item) => selectedIds.has(item.id));
      setDoneState(selected);
    },
    [setDoneState],
  );

  return { setDoneState, setDoneStateForIds };
}
