import { useEffect, useRef, useState } from "react";
import type {
  CarbonAttachment,
  CarbonItem,
  CarbonItemSource,
} from "../../../lib/model";
import { type AddedItem, useCarbonStore } from "../../../lib/store";
import {
  createDraftImage,
  saveImageFile,
} from "../clipboard";
import {
  hasStructuredHtmlText,
  imageOriginFromTransfer,
  requestsImageDrop,
  resolveDroppedContent,
} from "../drop";
import { getRememberedSource } from "../externalInputSource";
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
  const draftSourceRef = useRef<CarbonItemSource | undefined>(undefined);
  const draftSourceRequestRef = useRef<
    Promise<CarbonItemSource | undefined> | undefined
  >(undefined);

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
    input.style.height = `${Math.min(input.scrollHeight, 192)}px`;
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
    draftSourceRef.current = undefined;
    draftSourceRequestRef.current = undefined;
  }

  function startEditing(item: CarbonItem) {
    releaseDraftImages();
    setDraft(item.text);
    setDraftImages([]);
    setExistingAttachments(item.attachments);
    setEditingItemId(item.id);
    draftSourceRef.current = item.source;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(item.text.length, item.text.length);
    });
  }

  function insertDraftText(
    text: string,
    selection?: { end: number; start: number },
  ) {
    const incoming = text.trim();
    if (!incoming) return;
    setDraft((current) => {
      if (selection) {
        const start = Math.min(selection.start, current.length);
        const end = Math.min(selection.end, current.length);
        const next = `${current.slice(0, start)}${incoming}${current.slice(end)}`;
        requestAnimationFrame(() => {
          const input = inputRef.current;
          if (!input) return;
          const cursor = start + incoming.length;
          input.focus();
          input.setSelectionRange(cursor, cursor);
        });
        return next;
      }
      if (!current) return incoming;
      return `${current}${current.endsWith("\n") ? "" : "\n"}${incoming}`;
    });
  }

  function addPastedImages(data: DataTransfer) {
    if (!requestsImageDrop(data) && !hasStructuredHtmlText(data)) return false;
    const input = inputRef.current;
    const selection = input
      ? { start: input.selectionStart, end: input.selectionEnd }
      : undefined;
    const imageOrigin = imageOriginFromTransfer(data);
    const sourceRequest = getRememberedSource(imageOrigin.pageUrl).then(
      (source) => {
        if (source && !draftSourceRef.current) draftSourceRef.current = source;
        return source;
      },
    );
    draftSourceRequestRef.current = sourceRequest;
    void Promise.all([sourceRequest, resolveDroppedContent(data)])
      .then(async ([source, dropped]) => ({
        images: await Promise.all(
          dropped.images.map((image) =>
            createDraftImage(image.file, {
              sourceUrl: image.sourceUrl ?? imageOrigin.sourceUrl,
              pageUrl:
                image.pageUrl ??
                imageOrigin.pageUrl ??
                source?.pageUrl,
            }),
          ),
        ),
        text: dropped.text,
      }))
      .then(({ images, text }) => {
        setDraftImages((current) => [...current, ...images]);
        insertDraftText(text, selection);
        requestAnimationFrame(() => inputRef.current?.focus());
      })
      .catch(() => notify("Carbon couldn’t read that image.", "error"));
    return true;
  }

  async function addDroppedImages(data: DataTransfer) {
    try {
      const dropped = await resolveDroppedContent(data);
      if (
        dropped.unsupportedFiles ||
        (!dropped.text && dropped.images.length === 0)
      ) {
        notify(
          "That drop doesn’t contain supported text or an image.",
          "error",
        );
        return;
      }
      const pageUrl = dropped.images.find((image) => image.pageUrl)?.pageUrl;
      const sourceRequest = getRememberedSource(pageUrl);
      draftSourceRequestRef.current = sourceRequest;
      const source = await sourceRequest;
      if (source && !draftSourceRef.current) draftSourceRef.current = source;
      const images = await Promise.all(
        dropped.images.map((image) =>
          createDraftImage(image.file, {
            sourceUrl: image.sourceUrl,
            pageUrl: image.pageUrl ?? source?.pageUrl,
          }),
        ),
      );
      setDraftImages((current) => [...current, ...images]);
      insertDraftText(dropped.text);
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch {
      notify("Carbon couldn’t read that image.", "error");
    }
  }

  function rememberDroppedTextSource(data: DataTransfer) {
    const request = getRememberedSource(
      imageOriginFromTransfer(data).pageUrl,
    ).then((source) => {
      if (source && !draftSourceRef.current) draftSourceRef.current = source;
      return source;
    });
    draftSourceRequestRef.current = request;
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

  async function submitDraft(currentMarkdown?: string) {
    const text = (currentMarkdown ?? draft).trim();
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
      if (draftSourceRequestRef.current) {
        await draftSourceRequestRef.current;
      }
      const savedDraftImages: CarbonAttachment[] = await Promise.all(
        draftImages.map((image) =>
          saveImageFile(image.file, image.id, {
            sourceUrl: image.sourceUrl,
            pageUrl: image.pageUrl,
          }),
        ),
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
        const added = addEntry(text, attachments, draftSourceRef.current);
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
    rememberDroppedTextSource,
    savingDraft,
    setDraft,
    startEditing,
    submitDraft,
  };
}
