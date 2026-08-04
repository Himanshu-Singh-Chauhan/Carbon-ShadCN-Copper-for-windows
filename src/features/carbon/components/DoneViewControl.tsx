import {
  CheckmarkCircle02Icon,
  Delete02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { Icon } from "../../../components/ui/icon";
import type { DoneViewMode } from "../../../lib/model";
import { cn } from "../../../lib/utils";

const nextMode: Record<DoneViewMode, DoneViewMode> = {
  active: "all",
  all: "done",
  done: "active",
};

const descriptions: Record<DoneViewMode, string> = {
  active: "Done items are hidden. Click to show all items.",
  all: "Active and Done items are shown. Click to show only Done items.",
  done: "Only Done items are shown. Click to return to active items.",
};

export function DoneViewControl({
  doneCount,
  mode,
  onChange,
  onDeleteAll,
}: {
  doneCount: number;
  mode: DoneViewMode;
  onChange: (mode: DoneViewMode) => void;
  onDeleteAll: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className={cn(
          "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/35",
          mode === "active" &&
            "border-line bg-surface-raised text-muted hover:border-line-strong hover:bg-surface-hover hover:text-ink",
          mode === "all" &&
            "border-accent/35 bg-accent-soft text-ink hover:border-accent/55",
          mode === "done" &&
            "border-accent bg-accent text-accent-foreground shadow-sm hover:bg-accent-strong",
        )}
        onClick={() => onChange(nextMode[mode])}
        aria-label={descriptions[mode]}
        aria-pressed={mode !== "active"}
        title={descriptions[mode]}
      >
        <Icon
          icon={mode === "all" ? ViewIcon : CheckmarkCircle02Icon}
          size={14}
          strokeWidth={2.2}
        />
        <span>{mode === "all" ? "All" : "Done"}</span>
        <span
          className={cn(
            "tabular-nums",
            mode === "done" ? "text-accent-foreground/75" : "text-faint",
          )}
        >
          {doneCount}
        </span>
      </button>

      {mode === "done" && doneCount > 0 && (
        <button
          type="button"
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-raised text-muted outline-none transition-colors hover:border-danger/30 hover:bg-danger-soft hover:text-danger focus-visible:ring-2 focus-visible:ring-danger/30"
          onClick={onDeleteAll}
          aria-label="Delete all Done items"
          title="Delete all Done items"
        >
          <Icon icon={Delete02Icon} size={14} />
        </button>
      )}
    </div>
  );
}
