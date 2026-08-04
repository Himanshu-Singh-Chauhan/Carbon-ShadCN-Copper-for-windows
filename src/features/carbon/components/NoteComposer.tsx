import {
  Add01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  CircleIcon,
  FileEditIcon,
  InboxIcon,
  TextIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { AssetImage } from "../../../components/AssetImage";
import { ImageOriginIndicator } from "../../../components/ImageOriginIndicator";
import { MarkdownContent } from "../../../components/MarkdownContent";
import { Icon } from "../../../components/ui/icon";
import type { CarbonAttachment } from "../../../lib/model";
import { cn } from "../../../lib/utils";
import type { DraftImage } from "../types";
import {
  hasStructuredHtmlText,
  requestsImageDrop,
  supportsDrop,
} from "../drop";

export function NoteComposer({
  captureSectionName,
  draft,
  draftImages,
  editing,
  existingAttachments,
  inputRef,
  saving,
  onCancelEditing,
  onDraftChange,
  onDropImages,
  onDropTextSource,
  onOpenCommands,
  onOpenImage,
  onPaste,
  onRemoveDraftImage,
  onRemoveExistingImage,
  onSubmit,
}: {
  captureSectionName: string;
  draft: string;
  draftImages: DraftImage[];
  editing: boolean;
  existingAttachments: CarbonAttachment[];
  inputRef: RefObject<HTMLTextAreaElement | null>;
  saving: boolean;
  onCancelEditing: () => void;
  onDraftChange: (value: string) => void;
  onDropImages: (data: DataTransfer) => void;
  onDropTextSource: (data: DataTransfer) => void;
  onOpenCommands: () => void;
  onOpenImage: (index: number) => void;
  onPaste: (data: DataTransfer) => boolean;
  onRemoveDraftImage: (id: string) => void;
  onRemoveExistingImage: (id: string) => void;
  onSubmit: (value?: string) => void;
}) {
  const [dropActive, setDropActive] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const attachmentCount = existingAttachments.length + draftImages.length;
  const hasContent = editing || Boolean(draft.trim() || attachmentCount);
  const removeButtonStyles =
    "absolute right-1 top-1 inline-flex size-5 cursor-pointer items-center justify-center rounded-md bg-black/60 text-white opacity-0 outline-none backdrop-blur-sm transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100";

  useEffect(() => {
    if (!draft && attachmentCount === 0) setPreviewing(false);
  }, [attachmentCount, draft]);

  useEffect(() => {
    setPreviewing(false);
  }, [editing]);

  function setPreviewMode(preview: boolean) {
    setPreviewing(preview);
    requestAnimationFrame(() => {
      if (preview) previewRef.current?.focus();
      else {
        const input = inputRef.current;
        if (!input) return;
        input.style.height = "0px";
        input.style.height = `${Math.min(input.scrollHeight, 192)}px`;
        input.focus();
      }
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Tab") {
      event.preventDefault();
      setPreviewMode(!previewing);
      return;
    }
    if (previewing) return;
    if (event.key === "Escape" && editing) {
      event.preventDefault();
      onCancelEditing();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (onPaste(event.clipboardData)) event.preventDefault();
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    if (!supportsDrop(event.dataTransfer)) return;
    event.preventDefault();
    setDropActive(true);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (!supportsDrop(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDropActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    setDropActive(false);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    setDropActive(false);
    const containsFiles = Array.from(event.dataTransfer.types).includes("Files");
    if (
      !requestsImageDrop(event.dataTransfer) &&
      !hasStructuredHtmlText(event.dataTransfer) &&
      !containsFiles
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onDropImages(event.dataTransfer);
  }

  return (
    <footer
      className="relative shrink-0 px-3 pb-3 pt-1"
      data-composer-drop-zone
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDropCapture={handleDrop}
    >
      {dropActive && (
        <div className="pointer-events-none absolute -top-7 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-lg border border-accent/35 bg-surface-raised px-2.5 py-1.5 text-xs font-medium text-ink shadow-panel">
          Drop into note
        </div>
      )}
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-panel transition-[border-color,box-shadow] focus-within:border-accent/45 focus-within:shadow-float",
          dropActive && "border-accent/70 ring-2 ring-accent/20",
        )}
      >
        {editing && (
          <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-3 py-2">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-ink">
              <Icon className="shrink-0 text-muted" icon={FileEditIcon} size={13} />
              Editing item
            </span>
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1 rounded-md text-xs font-medium text-muted outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35"
              onClick={onCancelEditing}
            >
              <Icon icon={Cancel01Icon} size={12} />
              Cancel
            </button>
          </div>
        )}

        {attachmentCount > 0 && (
          <div className="flex gap-2 overflow-x-auto border-b border-line px-3 py-3">
            {existingAttachments.map((attachment, index) => (
              <div
                className="group relative size-16 shrink-0 overflow-hidden rounded-xl border border-line bg-surface"
                key={attachment.id}
              >
                <button
                  type="button"
                  className="h-full w-full cursor-zoom-in overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                  onClick={() => onOpenImage(index)}
                  aria-label={`Open attachment ${index + 1}`}
                >
                  <AssetImage
                    className="h-full w-full object-cover"
                    attachment={attachment}
                    alt=""
                    draggable={false}
                  />
                </button>
                <button
                  type="button"
                  className={removeButtonStyles}
                  onClick={() => onRemoveExistingImage(attachment.id)}
                  aria-label={`Remove attachment ${index + 1}`}
                >
                  <Icon icon={Cancel01Icon} size={11} />
                </button>
                <ImageOriginIndicator
                  className="bottom-1 left-1"
                  origin={attachment}
                />
              </div>
            ))}
            {draftImages.map((image, index) => {
              const combinedIndex = existingAttachments.length + index;
              return (
                <div
                  className="group relative size-16 shrink-0 overflow-hidden rounded-xl border border-line bg-surface"
                  key={image.id}
                >
                  <button
                    type="button"
                    className="h-full w-full cursor-zoom-in overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                    onClick={() => onOpenImage(combinedIndex)}
                    aria-label={`Open attachment ${combinedIndex + 1}`}
                  >
                    <img
                      className="h-full w-full object-cover"
                      src={image.previewUrl}
                      alt=""
                      draggable={false}
                    />
                  </button>
                  <button
                    type="button"
                    className={removeButtonStyles}
                    onClick={() => onRemoveDraftImage(image.id)}
                    aria-label={`Remove attachment ${combinedIndex + 1}`}
                  >
                    <Icon icon={Cancel01Icon} size={11} />
                  </button>
                  <ImageOriginIndicator
                    className="bottom-1 left-1"
                    origin={image}
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-start gap-2.5 px-3 py-3">
          <Icon
            className="mt-0.5 shrink-0 text-faint"
            icon={CircleIcon}
            size={19}
          />
          {previewing ? (
            <div
              ref={previewRef}
              className="max-h-48 min-h-6 min-w-0 flex-1 overflow-y-auto rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
              tabIndex={0}
              aria-label="Markdown preview"
              onKeyDown={handleKeyDown}
            >
              {draft.trim() ? (
                <MarkdownContent markdown={draft} />
              ) : (
                <span className="text-sm leading-[1.55] text-faint">
                  Nothing to preview
                </span>
              )}
            </div>
          ) : (
            <textarea
              ref={inputRef}
              className="max-h-48 min-h-6 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent text-sm leading-5 text-ink caret-ink outline-none placeholder:text-faint"
              value={draft}
              rows={1}
              placeholder={
                editing
                  ? "Edit this item or paste more images…"
                  : "Add a note or paste an image…"
              }
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={handleKeyDown}
              onDrop={(event) => onDropTextSource(event.dataTransfer)}
              onPaste={handlePaste}
            />
          )}
          <button
            type="button"
            className={cn(
              "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/35",
              previewing
                ? "border-accent/45 bg-accent-soft text-ink"
                : "border-line bg-surface text-muted hover:border-line-strong hover:bg-surface-hover hover:text-ink",
            )}
            onClick={() => setPreviewMode(!previewing)}
            aria-label={previewing ? "Edit raw Markdown" : "Preview Markdown"}
            aria-pressed={previewing}
            title={
              previewing
                ? "Edit raw Markdown (Tab)"
                : "Preview Markdown (Tab)"
            }
          >
            <Icon icon={previewing ? TextIcon : ViewIcon} size={16} />
          </button>
          {hasContent && (
            <button
              type="button"
              className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-sm outline-none transition-colors hover:bg-accent-strong focus-visible:ring-2 focus-visible:ring-accent/35 disabled:cursor-default disabled:opacity-45"
              onClick={() => onSubmit()}
              disabled={saving}
              aria-label={editing ? "Save changes" : "Add item"}
            >
              <Icon
                icon={editing ? CheckmarkCircle02Icon : Add01Icon}
                size={17}
                strokeWidth={2.2}
              />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface px-3 py-2">
          {editing ? (
            <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted">
              <Icon className="shrink-0" icon={FileEditIcon} size={12} />
              Edit mode
            </span>
          ) : (
            <button
              type="button"
              className="inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-md text-xs font-medium text-muted outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35"
              onClick={onOpenCommands}
            >
              <Icon className="shrink-0" icon={InboxIcon} size={12} />
              <span className="truncate">{captureSectionName}</span>
            </button>
          )}
          <span className="shrink-0 text-xs text-faint">
            <kbd className="font-medium">Enter</kbd>{" "}
            {editing ? "save" : "add"} ·{" "}
            {editing ? (
              <>
                <kbd className="font-medium">Esc</kbd> cancel
              </>
            ) : (
              <>
                <kbd className="font-medium">Shift Enter</kbd> new line
              </>
            )}
          </span>
        </div>
      </div>
    </footer>
  );
}
