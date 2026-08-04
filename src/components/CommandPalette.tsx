import {
  Add01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  File01Icon,
  Folder02Icon,
  Moon02Icon,
  Search01Icon,
  Settings02Icon,
  Sun02Icon,
} from "@hugeicons/core-free-icons";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Fzf } from "fzf";
import { useEffect, useMemo, useState } from "react";
import { ALL_SECTIONS, type CarbonSection } from "../lib/model";
import { cn } from "../lib/utils";
import { Icon, type IconData } from "./ui/icon";
import { DeleteBucketDialog } from "./DeleteBucketDialog";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buckets: CarbonSection[];
  activeBucketId: string;
  onSelectBucket: (id: string) => void;
  onCreateBucket: (name: string) => void;
  onDeleteBucket: (id: string) => void;
  onOpenSettings: () => void;
  onSetTheme: (theme: "light" | "dark") => void;
}

type Command = {
  id: string;
  label: string;
  detail?: string;
  group: "Buckets" | "Actions";
  icon: IconData;
  run: () => void;
  active?: boolean;
  bucket?: CarbonSection;
};

export function CommandPalette({
  open,
  onOpenChange,
  buckets,
  activeBucketId,
  onSelectBucket,
  onCreateBucket,
  onDeleteBucket,
  onOpenSettings,
  onSetTheme,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [bucketPendingDeletion, setBucketPendingDeletion] =
    useState<CarbonSection | null>(null);

  const commands = useMemo<Command[]>(
    () => [
      {
        id: "bucket-all",
        label: "All notes",
        detail: "Show every bucket",
        group: "Buckets",
        icon: File01Icon,
        active: activeBucketId === ALL_SECTIONS,
        run: () => onSelectBucket(ALL_SECTIONS),
      },
      ...buckets.map((bucket) => ({
        id: `bucket-${bucket.id}`,
        label: bucket.name,
        detail: `${bucket.items.length} ${
          bucket.items.length === 1 ? "item" : "items"
        }`,
        group: "Buckets" as const,
        icon: Folder02Icon,
        active: activeBucketId === bucket.id,
        bucket,
        run: () => onSelectBucket(bucket.id),
      })),
      {
        id: "settings",
        label: "Open settings",
        detail: "Shortcuts, appearance, and storage",
        group: "Actions",
        icon: Settings02Icon,
        run: onOpenSettings,
      },
      {
        id: "theme-light",
        label: "Use light theme",
        group: "Actions",
        icon: Sun02Icon,
        run: () => onSetTheme("light"),
      },
      {
        id: "theme-dark",
        label: "Use dark theme",
        group: "Actions",
        icon: Moon02Icon,
        run: () => onSetTheme("dark"),
      },
    ],
    [activeBucketId, buckets, onOpenSettings, onSelectBucket, onSetTheme],
  );

  const results = useMemo(() => {
    if (!query.trim()) return commands;
    const fzf = new Fzf(commands, {
      selector: (command) => `${command.label} ${command.detail ?? ""}`,
    });
    return fzf.find(query).map((result) => result.item);
  }, [commands, query]);

  useEffect(() => setActiveIndex(0), [query, open]);

  function run(command: Command) {
    command.run();
    setQuery("");
    onOpenChange(false);
  }

  function createBucket() {
    const name = query.trim().replace(/^#\s*/, "");
    if (!name) return;
    onCreateBucket(name);
    setQuery("");
    onOpenChange(false);
  }

  function requestBucketDeletion(bucket: CarbonSection) {
    setQuery("");
    onOpenChange(false);
    if (bucket.items.length === 0) {
      onDeleteBucket(bucket.id);
    } else {
      setBucketPendingDeletion(bucket);
    }
  }

  return (
    <>
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          if (!next) setQuery("");
          onOpenChange(next);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className="fixed inset-0 z-40 cursor-default rounded-2xl bg-black/45 backdrop-blur-[2px]"
            data-no-window-drag
          />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-1/2 z-50 isolate flex max-h-[calc(100vh-24px)] w-[calc(100vw-24px)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-line bg-surface-raised text-ink shadow-float outline-none"
            aria-describedby={undefined}
          >
          <DialogPrimitive.Title className="sr-only">
            Carbon commands
          </DialogPrimitive.Title>
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
            <Icon className="shrink-0 text-muted" icon={Search01Icon} size={18} />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Switch bucket or run a command…"
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((index) =>
                    results.length ? (index + 1) % results.length : 0,
                  );
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((index) =>
                    results.length
                      ? (index - 1 + results.length) % results.length
                      : 0,
                  );
                  return;
                }
                if (event.key === "Enter") {
                  if (query.trim().startsWith("#")) createBucket();
                  else if (results[activeIndex]) run(results[activeIndex]);
                  else createBucket();
                }
              }}
            />
            <kbd className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-xs font-medium text-faint">
              Esc
            </kbd>
          </div>
          <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto p-2.5">
            {(["Buckets", "Actions"] as const).map((group) => {
              const grouped = results.filter(
                (command) => command.group === group,
              );
              if (!grouped.length) return null;
              return (
                <div className="mb-2 last:mb-0" key={group}>
                  <p className="mb-1 px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-faint">
                    {group}
                  </p>
                  {grouped.map((command) => {
                    const resultIndex = results.findIndex(
                      (result) => result.id === command.id,
                    );
                    const active = resultIndex === activeIndex;
                    return (
                      <div
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none transition-colors",
                          active
                            ? "bg-accent-soft"
                            : "hover:bg-surface-hover",
                        )}
                        key={command.id}
                        onMouseEnter={() => setActiveIndex(resultIndex)}
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left outline-none"
                          onClick={() => run(command)}
                        >
                          <span
                            className={cn(
                              "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border",
                              active
                                ? "border-accent/20 bg-surface-raised text-accent"
                                : "border-line bg-surface text-muted",
                            )}
                          >
                            <Icon icon={command.icon} size={17} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <strong className="block truncate text-sm font-medium text-ink">
                              {command.label}
                            </strong>
                            {command.detail && (
                              <small className="mt-0.5 block truncate text-xs text-muted">
                                {command.detail}
                              </small>
                            )}
                          </span>
                          {command.active && (
                            <Icon
                              className="shrink-0 text-accent"
                              icon={CheckmarkCircle02Icon}
                              size={16}
                            />
                          )}
                        </button>
                        {command.bucket && (
                          <button
                            type="button"
                            className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-faint outline-none transition-colors hover:bg-danger-soft hover:text-danger focus-visible:ring-2 focus-visible:ring-danger/30"
                            onClick={() =>
                              requestBucketDeletion(command.bucket!)
                            }
                            aria-label={`Delete ${command.bucket.name}`}
                            title={`Delete ${command.bucket.name}`}
                          >
                            <Icon icon={Delete02Icon} size={15} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {results.length === 0 && (
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm text-ink outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent/35"
                onClick={createBucket}
              >
                <Icon className="text-accent" icon={Add01Icon} size={17} />
                Create bucket “{query.replace(/^#\s*/, "")}”
              </button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-4 rounded-b-2xl border-t border-line bg-surface px-4 py-2 text-xs text-faint">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-line bg-surface-raised px-1">
                ↑
              </kbd>
              <kbd className="rounded border border-line bg-surface-raised px-1">
                ↓
              </kbd>
              navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-line bg-surface-raised px-1">
                ↵
              </kbd>
              select
            </span>
            <span className="ml-auto hidden sm:inline">
              Type # Name to create a bucket
            </span>
          </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <DeleteBucketDialog
        bucket={bucketPendingDeletion}
        onConfirm={onDeleteBucket}
        onOpenChange={(next) => {
          if (!next) setBucketPendingDeletion(null);
        }}
      />
    </>
  );
}
