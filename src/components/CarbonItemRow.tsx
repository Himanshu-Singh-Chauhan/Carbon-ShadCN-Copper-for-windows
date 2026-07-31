import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical } from "lucide-react";
import type { MouseEvent } from "react";
import type { CarbonItem } from "../lib/model";
import { cn } from "../lib/utils";

interface CarbonItemRowProps {
  item: CarbonItem;
  selected: boolean;
  searchQuery: string;
  dragDisabled: boolean;
  onToggle: () => void;
  onSelect: (event: MouseEvent) => void;
  onContextMenu: (event: MouseEvent) => void;
  onEdit: () => void;
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
          <mark key={`${part}-${index}`}>{part}</mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function CarbonItemRow({
  item,
  selected,
  searchQuery,
  dragDisabled,
  onToggle,
  onSelect,
  onContextMenu,
  onEdit,
}: CarbonItemRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: dragDisabled });

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "note-card",
        item.completed && "note-card--completed",
        selected && "note-card--selected",
        isDragging && "note-card--dragging",
      )}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onDoubleClick={onEdit}
      data-item-id={item.id}
    >
      <button
        type="button"
        className={cn("check-button", item.completed && "check-button--checked")}
        aria-label={item.completed ? "Mark as not done" : "Mark as done"}
        aria-pressed={item.completed}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        {item.completed && <Check size={13} strokeWidth={3} />}
      </button>
      <p className="note-text">
        <HighlightedText text={item.text} query={searchQuery} />
      </p>
      {!dragDisabled && (
        <button
          type="button"
          className="drag-handle"
          aria-label="Drag to reorder"
          onClick={(event) => event.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={15} />
        </button>
      )}
    </article>
  );
}
