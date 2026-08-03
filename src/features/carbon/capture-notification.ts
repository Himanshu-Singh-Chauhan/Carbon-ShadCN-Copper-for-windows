import { showCaptureNotification } from "../../lib/native";
import { type AddedItem, useCarbonStore } from "../../lib/store";

export function showAddedItemNotification(
  added: AddedItem | undefined,
  message: string,
) {
  if (!added) return Promise.resolve();
  const state = useCarbonStore.getState();
  return showCaptureNotification({
    message,
    itemId: added.item.id,
    bucketId: added.sectionId,
    buckets: state.sections.map(({ id, name }) => ({ id, name })),
  });
}
