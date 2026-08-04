import { showCaptureNotification } from "../../lib/native";
import { type AddedItem, useCarbonStore } from "../../lib/store";

export function showAddedItemNotification(
  added: AddedItem | undefined,
  message: string,
) {
  if (!added) return Promise.resolve();
  const state = useCarbonStore.getState();
  const preview =
    added.item.text.replace(/\s+/g, " ").trim().slice(0, 160) ||
    (added.item.attachments.length === 1
      ? "1 image"
      : `${added.item.attachments.length} images`);
  return showCaptureNotification({
    kind: "saved",
    message,
    preview,
    itemId: added.item.id,
    bucketId: added.sectionId,
    buckets: state.sections.map(({ id, name }) => ({ id, name })),
  });
}

export function showCaptureStatusNotification(
  message: string,
  tone: "info" | "error" = "info",
) {
  return showCaptureNotification({
    kind: "status",
    message,
    notificationId: crypto.randomUUID(),
    tone,
  });
}
