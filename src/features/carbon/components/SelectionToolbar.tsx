import {
  Cancel01Icon,
  Copy01Icon,
  Delete02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { Icon } from "../../../components/ui/icon";

export function SelectionToolbar({
  count,
  copying,
  onClear,
  onCopy,
  onDelete,
}: {
  count: number;
  copying: boolean;
  onClear: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="absolute bottom-28 left-1/2 z-30 flex w-[calc(100%-32px)] max-w-sm -translate-x-1/2 items-center gap-2 rounded-2xl border border-line bg-surface-raised p-2 shadow-float">
      <button
        type="button"
        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-xl text-muted outline-none transition-colors hover:bg-surface-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35"
        onClick={onClear}
        aria-label="Clear selection"
      >
        <Icon icon={Cancel01Icon} size={14} />
      </button>
      <strong className="text-xs font-semibold text-ink">{count} selected</strong>
      <span className="flex-1" />
      <button
        type="button"
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium text-muted outline-none transition-colors hover:bg-surface-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35 disabled:cursor-default disabled:opacity-55"
        onClick={onCopy}
        disabled={copying}
        aria-busy={copying}
      >
        <Icon
          className={copying ? "animate-spin" : undefined}
          icon={copying ? Loading03Icon : Copy01Icon}
          size={14}
        />
        {copying ? "Copying…" : "Copy"}
      </button>
      <button
        type="button"
        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-xl text-danger outline-none transition-colors hover:bg-danger-soft focus-visible:ring-2 focus-visible:ring-danger/30"
        onClick={onDelete}
        aria-label="Delete selected"
      >
        <Icon icon={Delete02Icon} size={15} />
      </button>
    </div>
  );
}
