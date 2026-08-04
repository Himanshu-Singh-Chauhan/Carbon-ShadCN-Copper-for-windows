import {
  Drag01Icon,
  Search01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "../../../../components/ui/button";
import { Icon } from "../../../../components/ui/icon";

export function NoSearchResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
      <span className="mb-4 inline-flex size-11 items-center justify-center rounded-2xl border border-line bg-surface-raised text-faint shadow-sm">
        <Icon icon={Search01Icon} size={21} />
      </span>
      <strong className="text-sm font-semibold text-ink">
        No matching notes
      </strong>
      <p className="mb-4 mt-1.5 max-w-60 text-xs leading-5 text-muted">
        Try a shorter phrase or search another bucket.
      </p>
      <Button variant="outline" size="sm" onClick={onClear}>
        Clear search
      </Button>
    </div>
  );
}

export function NotesEmptyState({
  captureHotkey,
  captureReady,
  onFocusInput,
  onOpenCommands,
}: {
  captureHotkey: string;
  captureReady: boolean;
  onFocusInput: () => void;
  onOpenCommands: () => void;
}) {
  const shortcutStyles =
    "flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs text-muted outline-none transition-colors hover:bg-surface-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35";

  return (
    <div className="mx-auto flex min-h-full max-w-xs flex-col items-center justify-center px-4 py-12 text-center">
      <div className="relative mb-6 h-20 w-24">
        <div className="absolute left-5 top-2 h-14 w-14 -rotate-6 rounded-2xl border border-line bg-surface shadow-sm" />
        <div className="absolute right-4 top-3 h-14 w-14 rotate-6 rounded-2xl border border-line bg-surface shadow-sm" />
        <div className="absolute left-1/2 top-0 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-2xl border border-line-strong bg-surface-raised text-accent shadow-panel">
          <Icon icon={SparklesIcon} size={23} />
        </div>
      </div>
      <h2 className="text-sm font-semibold tracking-[-0.015em] text-ink">
        A quiet place for useful things
      </h2>
      <p className="mb-6 mt-2 max-w-64 text-xs leading-5 text-muted">
        Capture an answer, a link, or a half-formed thought. Carbon keeps it
        close without getting in your way.
      </p>
      <div className="w-full rounded-2xl border border-line bg-surface-raised p-1.5 shadow-sm">
        <button type="button" className={shortcutStyles} onClick={onFocusInput}>
          <span>Capture selected text</span>
          <kbd className="text-xs font-medium text-faint">{captureHotkey}</kbd>
        </button>
        <button type="button" className={shortcutStyles} onClick={onFocusInput}>
          <span>Add a note manually</span>
          <kbd className="text-xs font-medium text-faint">Enter</kbd>
        </button>
        <button
          type="button"
          className={shortcutStyles}
          onClick={onOpenCommands}
        >
          <span>Switch buckets</span>
          <kbd className="text-xs font-medium text-faint">Ctrl K</kbd>
        </button>
      </div>
      {!captureReady && (
        <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-xs leading-4 text-danger">
          The global shortcut is unavailable. Change it in Settings.
        </p>
      )}
      <Icon className="mt-6 text-faint/40" icon={Drag01Icon} size={16} />
    </div>
  );
}
