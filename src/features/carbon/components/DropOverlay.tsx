import { Download04Icon } from "@hugeicons/core-free-icons";
import { Icon } from "../../../components/ui/icon";

export function DropOverlay() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-28 z-50 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-2.5 rounded-xl border border-accent/40 bg-surface-raised/95 px-3 py-2.5 text-xs shadow-float backdrop-blur-sm">
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
        <Icon icon={Download04Icon} size={16} strokeWidth={2} />
      </span>
      <p className="min-w-0 whitespace-nowrap font-semibold text-ink">
        Drop to add as item
        <span className="ml-1.5 font-normal text-muted">Text or image</span>
      </p>
    </div>
  );
}
