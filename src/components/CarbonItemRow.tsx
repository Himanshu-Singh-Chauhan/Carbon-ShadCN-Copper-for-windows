import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckmarkCircle02Icon, Drag01Icon } from "@hugeicons/core-free-icons";
import type { DragEvent, MouseEvent } from "react";
import { formatAddedAt, formatExactAddedAt } from "../lib/dates";
import { prepareTextDrag, startImageDrag } from "../lib/dragOut";
import type { CarbonItem } from "../lib/model";
import { extractHttpUrls, splitTextByLinks } from "../lib/links";
import { openExternalUrl } from "../lib/native";
import { cn } from "../lib/utils";
import { AssetImage } from "./AssetImage";
import { ItemSourceBadge } from "./ItemSourceBadge";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { Icon } from "./ui/icon";

interface CarbonItemRowProps {
  item: CarbonItem;
  focused: boolean;
  selected: boolean;
  searchQuery: string;
  dragDisabled: boolean;
  now: number;
  showCreatedAt: boolean;
  showItemSources: boolean;
  showLinkPreviews: boolean;
  onToggle: () => void;
  onSelect: (event: MouseEvent) => void;
  onContextMenu: (event: MouseEvent) => void;
  onEdit: () => void;
  onOpenImage: (index: number) => void;
}

function HighlightedText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  if (!query.trim()) return text;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.trim().toLowerCase() ? (
          <mark
            className="rounded bg-accent-soft px-0.5 text-ink"
            key={`${part}-${index}`}
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function RichText({ text, query }: { text: string; query: string }) {
  return (
    <>
      {splitTextByLinks(text).map((part, index) =>
        part.kind === "link" ? (
          <a
            className="cursor-pointer text-accent underline decoration-accent/35 underline-offset-2 outline-none hover:decoration-accent focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-accent/35"
            href={part.value}
            key={`${part.value}-${index}`}
            rel="noreferrer"
            target="_blank"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void openExternalUrl(part.value);
            }}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <HighlightedText text={part.value} query={query} />
          </a>
        ) : (
          <HighlightedText
            key={`${part.value}-${index}`}
            text={part.value}
            query={query}
          />
        ),
      )}
    </>
  );
}

export function CarbonItemRow({
  item,
  focused,
  selected,
  searchQuery,
  dragDisabled,
  now,
  showCreatedAt,
  showItemSources,
  showLinkPreviews,
  onToggle,
  onSelect,
  onContextMenu,
  onEdit,
  onOpenImage,
}: CarbonItemRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: dragDisabled });
  const previewUrl = showLinkPreviews
    ? extractHttpUrls(item.text)[0]
    : undefined;

  function handleItemDragStart(event: DragEvent<HTMLElement>) {
    const target = event.target;
    if (
      !item.text.trim() ||
      (target instanceof Element &&
        target.closest("button, a, [data-no-item-drag]"))
    ) {
      event.preventDefault();
      return;
    }
    prepareTextDrag(event, item.text);
  }

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "group relative flex w-full min-w-0 max-w-full cursor-default items-start gap-3 overflow-hidden rounded-2xl border bg-surface-raised px-3 py-3 shadow-[0_1px_1px_rgb(0_0_0/0.025)] outline-none transition-[border-color,background-color,box-shadow,opacity,transform] duration-150",
        "hover:shadow-panel",
        selected
          ? "border-accent/55 bg-accent-soft ring-1 ring-accent/20 hover:border-accent/55"
          : focused
            ? "border-line-strong bg-surface-hover ring-1 ring-line-strong/30 hover:border-line-strong"
            : "border-line hover:border-line-strong",
        item.completed && "opacity-60",
        isDragging && "z-20 scale-[1.015] opacity-90 shadow-float",
      )}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onDoubleClick={onEdit}
      data-item-id={item.id}
      data-note-card
    >
      <button
        type="button"
        className={cn(
          "mt-0.5 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/35",
          item.completed
            ? "border-accent bg-accent text-accent-foreground"
            : "border-line-strong bg-surface hover:border-accent hover:bg-accent-soft",
        )}
        aria-label={item.completed ? "Mark as not done" : "Mark as done"}
        aria-pressed={item.completed}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        {item.completed && (
          <Icon icon={CheckmarkCircle02Icon} size={14} strokeWidth={2.6} />
        )}
      </button>
      <div
        className="min-w-0 max-w-full flex-1 overflow-hidden"
        draggable={Boolean(item.text.trim())}
        onDragStart={handleItemDragStart}
      >
        {item.attachments.length > 0 && (
          <div
            className={cn(
              "mb-2 grid min-w-0 max-w-full max-h-64 gap-1.5 overflow-hidden rounded-xl",
              item.attachments.length === 1 && "grid-cols-1",
              item.attachments.length === 2 && "grid-cols-2",
              item.attachments.length >= 3 && "grid-cols-2",
            )}
          >
            {item.attachments.map((attachment, index) => (
              <button
                type="button"
                className={cn(
                  "min-h-20 min-w-0 max-w-full cursor-grab overflow-hidden bg-surface-hover outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent active:cursor-grabbing",
                  item.attachments.length === 1 && "max-h-56",
                  item.attachments.length === 3 && index === 0 && "row-span-2",
                )}
                draggable
                key={attachment.id}
                onClick={(event) => {
                  event.stopPropagation();
                  if (event.ctrlKey || event.metaKey) {
                    onSelect(event);
                    return;
                  }
                  onOpenImage(index);
                }}
                onDoubleClick={(event) => event.stopPropagation()}
                onDragStart={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void startImageDrag(
                    attachment.path,
                    event.currentTarget.querySelector("img"),
                  ).catch(() => {});
                }}
                aria-label={`Open image ${index + 1} of ${item.attachments.length}`}
              >
                <AssetImage
                  className="h-full max-h-56 w-full max-w-full object-cover"
                  attachment={attachment}
                  alt=""
                  draggable={false}
                />
              </button>
            ))}
          </div>
        )}
        {item.text && (
          <p
            className={cn(
              "m-0 max-w-full whitespace-pre-wrap [overflow-wrap:anywhere] text-sm leading-[1.55] text-ink",
              item.completed && "line-through decoration-faint/70",
            )}
          >
            <RichText text={item.text} query={searchQuery} />
          </p>
        )}
        {previewUrl && <LinkPreviewCard url={previewUrl} />}
        {showItemSources && item.source && (
          <ItemSourceBadge source={item.source} />
        )}
        {showCreatedAt && (
          <time
            className="mt-2 block w-fit text-xs text-faint"
            dateTime={item.createdAt}
            title={formatExactAddedAt(item.createdAt)}
          >
            {formatAddedAt(item.createdAt, now)}
          </time>
        )}
      </div>
      {!dragDisabled && (
        <button
          type="button"
          className="mt-0.5 inline-flex size-6 shrink-0 cursor-grab items-center justify-center rounded-lg text-faint opacity-0 outline-none transition-[opacity,color,background-color] hover:bg-surface-hover hover:text-muted focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent/35 active:cursor-grabbing group-hover:opacity-100"
          aria-label="Drag to reorder"
          data-no-item-drag
          draggable={false}
          onClick={(event) => event.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <Icon icon={Drag01Icon} size={15} />
        </button>
      )}
    </article>
  );
}
