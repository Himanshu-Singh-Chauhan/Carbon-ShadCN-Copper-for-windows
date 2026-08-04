import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
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
  windowDropActive = false,
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
  windowDropActive?: boolean;
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
  const composerRef = useRef<HTMLDivElement>(null);
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showScrollButtons) return;

    const handleMouseMove = (e: MouseEvent) => {
      const groupEl = groupRef.current;
      if (!groupEl) return;

      const rect = groupEl.getBoundingClientRect();
      const proximity = 30; // 30px proximity boundary

      const isInside =
        e.clientX >= rect.left - proximity &&
        e.clientX <= rect.right + proximity &&
        e.clientY >= rect.top - proximity &&
        e.clientY <= rect.bottom + proximity;

      if (!isInside) {
        setShowScrollButtons(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [showScrollButtons]);

  const attachmentCount = existingAttachments.length + draftImages.length;
  const hasContent = editing || Boolean(draft.trim() || attachmentCount);
  const isLocked = editing || Boolean(draft.trim()) || attachmentCount > 0;
  const isExpanded = isLocked || isManuallyExpanded || dropActive || windowDropActive;

  const removeButtonStyles =
    "absolute right-1 top-1 inline-flex size-5 cursor-pointer items-center justify-center rounded-md bg-black/60 text-white opacity-0 outline-none backdrop-blur-sm transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100";

  useEffect(() => {
    const root = document.documentElement;
    if (isExpanded) {
      root.setAttribute("data-composer-expanded", "true");
    } else {
      root.removeAttribute("data-composer-expanded");
    }
    return () => {
      root.removeAttribute("data-composer-expanded");
    };
  }, [isExpanded]);

  useEffect(() => {
    if (!draft && attachmentCount === 0) setPreviewing(false);
  }, [attachmentCount, draft]);

  useEffect(() => {
    setPreviewing(false);
  }, [editing]);

  // Single-click outside listener to collapse immediately when empty
  useEffect(() => {
    if (!isExpanded) return;

    const handlePointerDownOutside = (e: PointerEvent) => {
      const composer = composerRef.current;
      if (composer && !composer.contains(e.target as Node)) {
        if (!isLocked) {
          setIsManuallyExpanded(false);
          inputRef.current?.blur();
        }
      }
    };

    window.addEventListener("pointerdown", handlePointerDownOutside);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDownOutside);
    };
  }, [isExpanded, isLocked]);

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
  const handleWheel = (e: React.WheelEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "TEXTAREA") {
      const textarea = target as HTMLTextAreaElement;
      if (textarea.scrollHeight > textarea.clientHeight) {
        return;
      }
    }
    const scrollContainer = document.querySelector("[data-notes-scroll]");
    if (scrollContainer) {
      scrollContainer.scrollTop += e.deltaY;
    }
  };
  return (
    <>
      {isExpanded && !isLocked && (
        <div
          className="fixed inset-0 z-20 bg-transparent pointer-events-auto"
          onWheel={handleWheel}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsManuallyExpanded(false);
            inputRef.current?.blur();
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsManuallyExpanded(false);
            inputRef.current?.blur();
          }}
        />
      )}
      <footer
        className="pointer-events-none absolute bottom-0 inset-x-0 h-0 z-30 bg-transparent flex justify-center items-end"
        data-composer-drop-zone
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDropCapture={handleDrop}
      >
      {/* Collapsed Bar: Plus Button (Centered) + Proximity-triggered Scroll Up / Scroll Down Buttons */}
      <div
        ref={groupRef}
        className={cn(
          "pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-40 transition-all duration-200",
          isExpanded ? "opacity-0 scale-75 pointer-events-none" : "opacity-100 scale-100 pointer-events-auto"
        )}
      >
        {/* Scroll Up Button */}
        <button
          type="button"
          className={cn(
            "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-raised text-muted shadow-sm outline-none transition-all active:scale-95 hover:border-line-strong hover:bg-surface-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35 duration-200",
            showScrollButtons
              ? "opacity-100 scale-100 pointer-events-auto"
              : "opacity-0 scale-75 pointer-events-none"
          )}
          onClick={() => {
            const container = document.querySelector<HTMLElement>("[data-notes-scroll]");
            container?.scrollTo({ top: 0, behavior: "smooth" });
          }}
          aria-label="Scroll to top"
          title="Scroll to top"
        >
          <Icon icon={ArrowUp01Icon} size={15} />
        </button>

        {/* Center Add Button */}
        <button
          type="button"
          className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-float outline-none transition-transform active:scale-95 hover:bg-accent-strong focus-visible:ring-2 focus-visible:ring-accent/35"
          onMouseEnter={() => setShowScrollButtons(true)}
          onClick={() => {
            setIsManuallyExpanded(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          aria-label="Open Note Composer"
          title="Add Note (+)"
        >
          <Icon icon={Add01Icon} size={17} strokeWidth={2.2} />
        </button>

        {/* Scroll Down Button */}
        <button
          type="button"
          className={cn(
            "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-raised text-muted shadow-sm outline-none transition-all active:scale-95 hover:border-line-strong hover:bg-surface-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35 duration-200",
            showScrollButtons
              ? "opacity-100 scale-100 pointer-events-auto"
              : "opacity-0 scale-75 pointer-events-none"
          )}
          onClick={() => {
            const container = document.querySelector<HTMLElement>("[data-notes-scroll]");
            if (container) {
              container.scrollTo({ top: container.scrollHeight + 1000, behavior: "smooth" });
            }
          }}
          aria-label="Scroll to bottom"
          title="Scroll to bottom"
        >
          <Icon icon={ArrowDown01Icon} size={15} />
        </button>
      </div>

      {/* Expanded Composer Input Card (Absolute position, zero layout shift) */}
      <div
        ref={composerRef}
        className={cn(
          "pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-2xl transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] origin-bottom z-30",
          isExpanded
            ? "scale-100 opacity-100 translate-y-0 pointer-events-auto"
            : "scale-95 opacity-0 translate-y-2 pointer-events-none"
        )}
      >
        {(dropActive || windowDropActive) && (
          <div className="pointer-events-none absolute -top-7 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-lg border border-accent/35 bg-surface-raised px-2.5 py-1.5 text-xs font-medium text-ink shadow-panel">
            Drop into note
          </div>
        )}
        <div
          onWheel={handleWheel}
          className={cn(
            "overflow-hidden rounded-2xl border border-line-strong/60 bg-surface/95 backdrop-blur-md shadow-float transition-all duration-200 focus-within:ring-4 focus-within:ring-line-strong/35",
            (dropActive || windowDropActive) && "ring-4 ring-accent/40",
          )}
        >
          {editing && (
            <div className="flex items-center justify-between gap-3 border-b border-line/80 bg-surface-raised/70 px-3.5 py-2">
              <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-ink">
                <Icon className="shrink-0 text-accent" icon={FileEditIcon} size={13} />
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
            <div className="flex gap-2 overflow-x-auto border-b border-line/80 px-3.5 py-3">
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

          <div className="flex items-start gap-3 px-3.5 py-3">
            {previewing ? (
              <div
                ref={previewRef}
                className="max-h-48 min-h-6 min-w-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
                tabIndex={0}
                aria-label="Markdown preview"
                onKeyDown={handleKeyDown}
              >
                {draft.trim() ? (
                  <MarkdownContent markdown={draft} />
                ) : (
                  <span className="text-sm leading-6 text-faint">
                    Nothing to preview
                  </span>
                )}
              </div>
            ) : (
              <textarea
                ref={inputRef}
                className="max-h-48 min-h-[38px] min-w-0 flex-1 resize-none overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-transparent text-sm leading-6 text-ink caret-ink outline-none placeholder:text-muted/70 font-normal"
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
            <div className="flex flex-col items-center gap-1.5 shrink-0 self-end">
              <button
                type="button"
                className={cn(
                  "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/35",
                  previewing
                    ? "border-accent/45 bg-accent-soft text-ink"
                    : "border-line bg-surface-raised text-muted hover:border-line-strong hover:bg-surface-hover hover:text-ink",
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
                  className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-sm outline-none transition-transform active:scale-95 hover:bg-accent-strong focus-visible:ring-2 focus-visible:ring-accent/35 disabled:cursor-default disabled:opacity-45"
                  onClick={() => onSubmit()}
                  disabled={saving}
                  aria-label={editing ? "Save changes" : "Add item"}
                >
                  <Icon
                    icon={editing ? CheckmarkCircle02Icon : Add01Icon}
                    size={16}
                    strokeWidth={2.2}
                  />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line/60 bg-transparent px-3.5 py-2">
            {editing ? (
              <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted">
                <Icon className="shrink-0 text-accent" icon={FileEditIcon} size={12} />
                Edit mode
              </span>
            ) : (
              <button
                type="button"
                className="inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border border-line/70 bg-surface/80 px-2 py-0.5 text-xs font-medium text-muted outline-none transition-colors hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35"
                onClick={onOpenCommands}
              >
                <Icon className="shrink-0 text-faint" icon={InboxIcon} size={12} />
                <span className="truncate">{captureSectionName}</span>
              </button>
            )}
            <span className="shrink-0 text-xs text-faint flex items-center gap-1">
              <kbd className="rounded border border-line/80 bg-surface px-1.5 py-0.2 font-mono text-[10px] font-semibold text-muted shadow-2xs">Enter</kbd>{" "}
              <span className="text-muted/80">{editing ? "save" : "add"}</span>
              <span className="px-0.5 opacity-40">·</span>
              {editing ? (
                <>
                  <kbd className="rounded border border-line/80 bg-surface px-1.5 py-0.2 font-mono text-[10px] font-semibold text-muted shadow-2xs">Esc</kbd>{" "}
                  <span className="text-muted/80">cancel</span>
                </>
              ) : (
                <>
                  <kbd className="rounded border border-line/80 bg-surface px-1.5 py-0.2 font-mono text-[10px] font-semibold text-muted shadow-2xs">Shift Enter</kbd>{" "}
                  <span className="text-muted/80">new line</span>
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </footer>
  </>
);
}
