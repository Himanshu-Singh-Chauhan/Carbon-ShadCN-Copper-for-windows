import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
} from "react";
import type {
  CarbonAttachment,
  CarbonItem,
} from "../../../lib/model";
import { type AddedItem, useCarbonStore } from "../../../lib/store";
import {
  createDraftImage,
  imageFilesFromClipboard,
  saveImageFile,
} from "../clipboard";
import { resolveDroppedContent } from "../drop";
import type { DraftImage, Notify } from "../types";

export function useDraftComposer({
  addEntry,
  deleteItems,
  notify,
  onItemAdded,
  updateItem,
}: {
  addEntry: ReturnType<typeof useCarbonStore.getState>["addEntry"];
  deleteItems: ReturnType<typeof useCarbonStore.getState>["deleteItems"];
  notify: Notify;
  onItemAdded: (added: AddedItem) => void;
  updateItem: ReturnType<typeof useCarbonStore.getState>["updateItem"];
}) {
  const [draft, setDraft] = useState("");
  const [draftImages, setDraftImages] = useState<DraftImage[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<
    CarbonAttachment[]
  >([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const draftImagesRef = useRef<DraftImage[]>([]);

  useEffect(() => {
    draftImagesRef.current = draftImages;
  }, [draftImages]);

  useEffect(
    () => () => {
      draftImagesRef.current.forEach((image) =>
        URL.revokeObjectURL(image.previewUrl),
      );
    },
    [],
  );

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "0px";
    input.style.height = `${Math.min(input.scrollHeight, 124)}px`;
  }, [draft]);

  function releaseDraftImages() {
    draftImagesRef.current.forEach((image) =>
      URL.revokeObjectURL(image.previewUrl),
    );
    draftImagesRef.current = [];
  }

  function resetComposer() {
    releaseDraftImages();
    setDraft("");
    setDraftImages([]);
    setExistingAttachments([]);
    setEditingItemId(null);
  }

  function startEditing(item: CarbonItem) {
    releaseDraftImages();
    setDraft(item.text);
    setDraftImages([]);
    setExistingAttachments(item.attachments);
    setEditingItemId(item.id);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(item.text.length, item.text.length);
    });
  }

  async function addPastedImages(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = imageFilesFromClipboard(event.clipboardData);
    if (files.length === 0) return;
    event.preventDefault();
    try {
      const images = await Promise.all(files.map(createDraftImage));
      setDraftImages((current) => [...current, ...images]);
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch {
      notify("Carbon couldn’t read that image.", "error");
    }
  }

  async function addDroppedImages(data: DataTransfer) {
    try {
      const dropped = await resolveDroppedContent(data);
      if (!dropped.imageRequested || dropped.images.length === 0) return;
      const images = await Promise.all(dropped.images.map(createDraftImage));
      setDraftImages((current) => [...current, ...images]);
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch {
      notify("Carbon couldn’t read that image.", "error");
    }
  }

  function removeDraftImage(id: string) {
    setDraftImages((current) => {
      const removing = current.find((image) => image.id === id);
      if (removing) URL.revokeObjectURL(removing.previewUrl);
      return current.filter((image) => image.id !== id);
    });
    inputRef.current?.focus();
  }

  function removeExistingAttachment(id: string) {
    setExistingAttachments((current) =>
      current.filter((attachment) => attachment.id !== id),
    );
    inputRef.current?.focus();
  }

  async function submitDraft() {
    const text = draft.trim();
    const isEditing = editingItemId !== null;
    if (
      (!isEditing &&
        !text &&
        draftImages.length === 0 &&
        existingAttachments.length === 0) ||
      savingDraft
    ) {
      return;
    }
    setSavingDraft(true);
    try {
      const savedDraftImages: CarbonAttachment[] = await Promise.all(
        draftImages.map((image) => saveImageFile(image.file, image.id)),
      );
      const attachments = [...existingAttachments, ...savedDraftImages];

      if (editingItemId) {
        if (!text && attachments.length === 0) {
          deleteItems([editingItemId]);
          notify("Item deleted");
        } else {
          updateItem(editingItemId, text, attachments);
          notify("Changes saved");
        }
      } else {
        const added = addEntry(text, attachments);
        if (attachments.length === 0 && /^#\s+/.test(text)) {
          notify("Bucket created");
        } else if (added) {
          onItemAdded(added);
        }
      }
      resetComposer();
    } catch (error) {
      notify(`Couldn’t save image: ${String(error)}`, "error");
    } finally {
      setSavingDraft(false);
    }
  }

  return {
    addDroppedImages,
    addPastedImages,
    cancelEditing: resetComposer,
    draft,
    draftImages,
    editingItemId,
    existingAttachments,
    inputRef,
    removeDraftImage,
    removeExistingAttachment,
    savingDraft,
    setDraft,
    startEditing,
    submitDraft,
  };
}
