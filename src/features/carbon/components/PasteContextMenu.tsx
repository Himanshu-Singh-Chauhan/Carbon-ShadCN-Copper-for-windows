import { ClipboardPasteIcon } from "@hugeicons/core-free-icons";
import { Icon } from "../../../components/ui/icon";

export function PasteContextMenu({
  x,
  y,
  onPaste,
}: {
  x: number;
  y: number;
  onPaste: () => void;
}) {
  return (
    <div
      className="fixed z-[80] min-w-44 rounded-xl border border-line bg-surface-raised p-1.5 shadow-float"
      style={{ left: x, top: y }}
      onPointerDown={(event) => event.stopPropagation()}
      role="menu"
    >
      <button
        type="button"
        className="flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink outline-none transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover"
        role="menuitem"
        onClick={onPaste}
      >
        <Icon className="shrink-0 text-muted" icon={ClipboardPasteIcon} size={15} />
        Paste
        <kbd className="ml-auto text-xs text-faint">Ctrl V</kbd>
      </button>
    </div>
  );
}
