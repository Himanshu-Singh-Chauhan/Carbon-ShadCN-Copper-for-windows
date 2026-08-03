import {
  ArrowDown01Icon,
  CheckmarkCircle02Icon,
  ClipboardIcon,
  Copy01Icon,
  Delete02Icon,
  FileEditIcon,
  InboxIcon,
  Menu01Icon,
} from "@hugeicons/core-free-icons";
import { useState } from "react";
import { Icon } from "../../../components/ui/icon";
import type { CarbonItem, CarbonSection } from "../../../lib/model";
import { cn } from "../../../lib/utils";
import type { ContextMenuState } from "../types";

const itemStyles =
  "flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink outline-none transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover [&>svg]:shrink-0 [&>svg]:text-muted";

export function ItemContextMenu({
  state,
  item,
  selectedItems,
  sections,
  onCopy,
  onToggle,
  onEdit,
  onMove,
  onDelete,
}: {
  state: NonNullable<ContextMenuState>;
  item: CarbonItem;
  selectedItems: CarbonItem[];
  sections: CarbonSection[];
  onCopy: (asList: boolean) => void;
  onToggle: () => void;
  onEdit: () => void;
  onMove: (sectionId: string) => void;
  onDelete: () => void;
}) {
  const [showMove, setShowMove] = useState(false);

  return (
    <div
      className="fixed z-[80] min-w-52 rounded-xl border border-line bg-surface-raised p-1.5 shadow-float"
      style={{ left: state.x, top: state.y }}
      onPointerDown={(event) => event.stopPropagation()}
      role="menu"
    >
      {selectedItems.length > 1 && (
        <div className="px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.1em] text-faint">
          {selectedItems.length} selected notes
        </div>
      )}
      <button
        type="button"
        className={itemStyles}
        role="menuitem"
        onClick={() => onCopy(false)}
      >
        <Icon icon={Copy01Icon} size={15} />
        Copy
        <kbd className="ml-auto text-xs text-faint">Ctrl C</kbd>
      </button>
      <button
        type="button"
        className={itemStyles}
        role="menuitem"
        onClick={() => onCopy(true)}
      >
        <Icon icon={ClipboardIcon} size={15} />
        Copy as list
      </button>
      <div className="mx-1 my-1.5 h-px bg-line" />
      <button
        type="button"
        className={itemStyles}
        role="menuitem"
        onClick={onToggle}
      >
        <Icon icon={CheckmarkCircle02Icon} size={15} />
        {item.completed ? "Mark as not done" : "Mark as done"}
        <kbd className="ml-auto text-xs text-faint">Space</kbd>
      </button>
      <button
        type="button"
        className={itemStyles}
        role="menuitem"
        onClick={onEdit}
      >
        <Icon icon={FileEditIcon} size={15} />
        Edit
        <kbd className="ml-auto text-xs text-faint">Enter</kbd>
      </button>
      <div className="relative">
        <button
          type="button"
          className={itemStyles}
          role="menuitem"
          onMouseEnter={() => setShowMove(true)}
          onClick={() => setShowMove((value) => !value)}
        >
          <Icon icon={Menu01Icon} size={15} />
          Move to
          <Icon className="ml-auto text-faint" icon={ArrowDown01Icon} size={13} />
        </button>
        {showMove && (
          <div
            className={cn(
              "absolute top-0 min-w-44 rounded-xl border border-line bg-surface-raised p-1.5 shadow-float",
              state.x > window.innerWidth - 410
                ? "right-[calc(100%+6px)]"
                : "left-[calc(100%+6px)]",
            )}
          >
            {sections.map((section) => (
              <button
                type="button"
                className={itemStyles}
                key={section.id}
                onClick={() => onMove(section.id)}
              >
                <Icon icon={InboxIcon} size={14} />
                <span className="truncate">{section.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mx-1 my-1.5 h-px bg-line" />
      <button
        type="button"
        role="menuitem"
        className={`${itemStyles} text-danger hover:bg-danger-soft [&>svg]:text-danger`}
        onClick={onDelete}
      >
        <Icon icon={Delete02Icon} size={15} />
        Delete
        <kbd className="ml-auto text-xs text-danger/70">Del</kbd>
      </button>
    </div>
  );
}
