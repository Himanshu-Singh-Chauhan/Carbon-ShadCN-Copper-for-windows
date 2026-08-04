import {
  Add01Icon,
  ArrowDown01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  BucketIcon,
  InboxIcon,
} from "@hugeicons/core-free-icons";
import { ALL_SECTIONS, type CarbonSection } from "../lib/model";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Icon } from "./ui/icon";
import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { useCarbonStore } from "../lib/store";
import { cn } from "../lib/utils";

export function BucketMenu({
  activeBucketId,
  activeName,
  buckets,
  itemCount,
  onSelect,
}: {
  activeBucketId: string;
  activeName: string;
  buckets: CarbonSection[];
  itemCount: number;
  onSelect: (bucketId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newBucketName, setNewBucketName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const createSection = useCarbonStore((state) => state.createSection);

  const totalItems = buckets.reduce(
    (total, bucket) => total + bucket.items.length,
    0,
  );

  const handleCreateBucket = (e?: FormEvent) => {
    e?.preventDefault();
    const name = newBucketName.trim();
    if (name) {
      createSection(name);
      setNewBucketName("");
      setIsCreating(false);
      setOpen(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsCreating(false);
      setNewBucketName("");
      e.stopPropagation();
    } else if (e.key === "Enter") {
      handleCreateBucket();
      e.stopPropagation();
    } else {
      e.stopPropagation();
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCreating(false);
    setNewBucketName("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setIsCreating(false);
      setNewBucketName("");
    }
  };

  useEffect(() => {
    if (isCreating) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isCreating]);

  const isAllNotes = activeBucketId === ALL_SECTIONS;
  const triggerIcon = isAllNotes ? InboxIcon : BucketIcon;

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 min-w-0 max-w-44 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface-raised px-2 text-xs font-medium text-muted shadow-sm outline-none transition-colors hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35"
          aria-label={`Change bucket. Currently ${activeName}`}
        >
          <Icon className="shrink-0" icon={triggerIcon} size={13} />
          <span className="truncate text-ink">{activeName}</span>
          <span className="shrink-0 tabular-nums text-faint">{itemCount}</span>
          <Icon className="shrink-0 text-faint" icon={ArrowDown01Icon} size={12} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56" align="start">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Buckets</span>
          {!isCreating && (
            <button
              type="button"
              className="flex size-5 cursor-pointer items-center justify-center rounded-md bg-accent text-accent-foreground shadow-xs outline-none transition-all active:scale-95 hover:bg-accent-strong focus-visible:ring-2 focus-visible:ring-accent/35"
              onClick={(e) => {
                e.stopPropagation();
                setIsCreating(true);
              }}
              title="Add new bucket"
            >
              <Icon icon={Add01Icon} size={11} strokeWidth={2.4} />
            </button>
          )}
        </DropdownMenuLabel>
        
        {/* Inline Create Bucket Section */}
        {isCreating && (
          <div className="px-2 pb-2 pt-0.5 border-b border-line/60">
            <form
              onSubmit={handleCreateBucket}
              className="flex items-center gap-1 rounded-lg border border-line bg-surface px-1.5 py-1"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <input
                ref={inputRef}
                type="text"
                placeholder="New bucket name..."
                className="min-w-0 flex-1 bg-transparent text-xs text-ink outline-none placeholder:text-faint"
                value={newBucketName}
                onChange={(e) => setNewBucketName(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                type="submit"
                className="flex size-6 cursor-pointer items-center justify-center rounded-md bg-accent text-accent-foreground hover:bg-accent-strong outline-none disabled:opacity-50 disabled:cursor-default"
                disabled={!newBucketName.trim()}
                title="Create bucket"
              >
                <Icon icon={CheckmarkCircle02Icon} size={13} />
              </button>
              <button
                type="button"
                className="flex size-6 cursor-pointer items-center justify-center rounded-md text-faint hover:bg-surface-hover hover:text-ink outline-none"
                onClick={handleCancel}
                title="Cancel"
              >
                <Icon icon={Cancel01Icon} size={13} />
              </button>
            </form>
          </div>
        )}

        <div className="flex flex-col gap-0.5">
          <DropdownMenuItem
            className={cn(
              "w-full justify-start",
              activeBucketId === ALL_SECTIONS
                ? "bg-accent-soft text-ink font-medium data-[highlighted]:bg-accent-soft"
                : "text-muted hover:text-ink"
            )}
            onSelect={() => onSelect(ALL_SECTIONS)}
          >
            <Icon className={activeBucketId === ALL_SECTIONS ? "text-accent" : "text-muted"} icon={InboxIcon} size={15} />
            <span className="min-w-0 flex-1 truncate">All notes</span>
            <span className="tabular-nums text-faint">{totalItems}</span>
          </DropdownMenuItem>
          {buckets.map((bucket) => {
            const isActive = activeBucketId === bucket.id;
            return (
              <DropdownMenuItem
                key={bucket.id}
                className={cn(
                  "w-full justify-start",
                  isActive
                    ? "bg-accent-soft text-ink font-medium data-[highlighted]:bg-accent-soft"
                    : "text-muted hover:text-ink"
                )}
                onSelect={() => onSelect(bucket.id)}
              >
                <Icon className={isActive ? "text-accent" : "text-muted"} icon={BucketIcon} size={15} />
                <span className="min-w-0 flex-1 truncate">{bucket.name}</span>
                <span className="tabular-nums text-faint">
                  {bucket.items.length}
                </span>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
