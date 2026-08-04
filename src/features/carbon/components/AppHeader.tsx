import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Download01Icon,
  FolderOpenIcon,
  InboxIcon,
  MoreHorizontalIcon,
  Minimize01Icon,
  PinIcon,
  PinOffIcon,
  Search01Icon,
  Settings02Icon,
} from "@hugeicons/core-free-icons";
import type { RefObject } from "react";
import { BucketMenu } from "../../../components/BucketMenu";
import {
  SourceFilterMenu,
  type SourceFilterOption,
} from "../../../components/SourceFilterMenu";
import { SortModeMenu } from "../../../components/SortModeMenu";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { Icon } from "../../../components/ui/icon";
import {
  ALL_SECTIONS,
  type CarbonSection,
  type CarbonSettings,
  type DoneViewMode,
  type NoteSortMode,
} from "../../../lib/model";
import { DoneViewControl } from "./DoneViewControl";

export function AppHeader({
  activeName,
  activeBucketId,
  buckets,
  doneCount,
  doneViewMode,
  itemCount,
  query,
  searchRef,
  settings,
  sortMode,
  sourceFilterOptions,
  selectedSourceKeys,
  onAlwaysOnTopChange,
  onCheckUpdates,
  onClearQuery,
  onClearSourceFilter,
  onCopyMarkdown,
  onDeleteAllDone,
  onDoneViewModeChange,
  onOpenCommands,
  onMinimizeToTray,
  onOpenSettings,
  onQueryChange,
  onQuit,
  onRevealData,
  onSelectBucket,
  onSortModeChange,
  onToggleSourceFilter,
}: {
  activeName: string;
  activeBucketId: string;
  buckets: CarbonSection[];
  doneCount: number;
  doneViewMode: DoneViewMode;
  itemCount: number;
  query: string;
  searchRef: RefObject<HTMLInputElement | null>;
  settings: CarbonSettings;
  sortMode?: NoteSortMode;
  sourceFilterOptions: SourceFilterOption[];
  selectedSourceKeys: string[];
  onAlwaysOnTopChange: (value: boolean) => void;
  onCheckUpdates: () => void;
  onClearQuery: () => void;
  onClearSourceFilter: () => void;
  onCopyMarkdown: () => void;
  onDeleteAllDone: () => void;
  onDoneViewModeChange: (mode: DoneViewMode) => void;
  onOpenCommands: () => void;
  onMinimizeToTray: () => void;
  onOpenSettings: () => void;
  onQueryChange: (value: string) => void;
  onQuit: () => void;
  onRevealData: () => void;
  onSelectBucket: (bucketId: string) => void;
  onSortModeChange?: (sortMode: NoteSortMode) => void;
  onToggleSourceFilter: (key: string) => void;
}) {
  return (
    <header
      className={
        activeBucketId === ALL_SECTIONS
          ? "relative z-10 shrink-0 px-3 pt-4"
          : "relative z-10 shrink-0 px-3 pb-2 pt-4"
      }
    >
      <div className="flex items-center gap-2">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface-raised px-3 text-muted shadow-sm transition-[border-color,box-shadow] focus-within:border-accent/55 focus-within:ring-2 focus-within:ring-accent/10">
          <Icon className="shrink-0 text-faint" icon={Search01Icon} size={17} />
          <input
            ref={searchRef}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search notes"
            aria-label="Search notes"
          />
          {query ? (
            <button
              className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-faint outline-none transition-colors hover:bg-surface-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35"
              type="button"
              onClick={onClearQuery}
              aria-label="Clear"
            >
              <Icon icon={Cancel01Icon} size={13} />
            </button>
          ) : (
            <kbd className="shrink-0 rounded-md border border-line bg-surface px-1.5 py-0.5 text-xs font-medium text-faint">
              Ctrl F
            </kbd>
          )}
        </label>

        <button
          className={
            settings.alwaysOnTop
              ? "inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-accent/45 bg-accent-soft text-ink shadow-sm outline-none transition-colors hover:border-accent/65 focus-visible:ring-2 focus-visible:ring-accent/35"
              : "inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-raised text-muted shadow-sm outline-none transition-colors hover:border-line-strong hover:bg-surface-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35"
          }
          type="button"
          onClick={() => onAlwaysOnTopChange(!settings.alwaysOnTop)}
          aria-label={
            settings.alwaysOnTop
              ? "Turn off always on top"
              : "Turn on always on top"
          }
          aria-pressed={settings.alwaysOnTop}
          title={
            settings.alwaysOnTop
              ? "Always on top is on"
              : "Always on top is off"
          }
        >
          <Icon
            icon={settings.alwaysOnTop ? PinIcon : PinOffIcon}
            size={18}
          />
        </button>

        <button
          className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-raised text-muted shadow-sm outline-none transition-colors hover:border-line-strong hover:bg-surface-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35"
          type="button"
          onClick={onMinimizeToTray}
          aria-label="Minimize to tray"
          title="Minimize to tray"
        >
          <Icon icon={Minimize01Icon} size={18} />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-raised text-muted shadow-sm outline-none transition-colors hover:border-line-strong hover:bg-surface-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35"
              type="button"
              aria-label="Carbon menu"
            >
              <Icon icon={MoreHorizontalIcon} size={19} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>View</DropdownMenuLabel>
            <DropdownMenuItem onSelect={onOpenCommands}>
              <Icon icon={InboxIcon} size={15} />
              Switch bucket
              <DropdownMenuShortcut>Ctrl K</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuCheckboxItem
              checked={settings.alwaysOnTop}
              onCheckedChange={(value) =>
                onAlwaysOnTopChange(Boolean(value))
              }
            >
              <Icon
                icon={settings.alwaysOnTop ? PinIcon : PinOffIcon}
                size={15}
              />
              Always on top
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onCopyMarkdown}>
              <Icon icon={Download01Icon} size={15} />
              Copy view as Markdown
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onRevealData}>
              <Icon icon={FolderOpenIcon} size={15} />
              Reveal local data
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onCheckUpdates}>
              <Icon icon={CheckmarkCircle02Icon} size={15} />
              Check for updates
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onOpenSettings}>
              <Icon icon={Settings02Icon} size={15} />
              Settings
              <DropdownMenuShortcut>Ctrl ,</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-danger data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger"
              onSelect={onQuit}
            >
              <Icon icon={Cancel01Icon} size={15} />
              Quit Carbon
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2.5 flex min-w-0 items-center gap-2">
        <BucketMenu
          activeBucketId={activeBucketId}
          activeName={activeName}
          buckets={buckets}
          itemCount={itemCount}
          onSelect={onSelectBucket}
        />
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
          <DoneViewControl
            doneCount={doneCount}
            mode={doneViewMode}
            onChange={onDoneViewModeChange}
            onDeleteAll={onDeleteAllDone}
          />
          {(sourceFilterOptions.length > 0 ||
            selectedSourceKeys.length > 0) && (
            <SourceFilterMenu
              options={sourceFilterOptions}
              selectedKeys={selectedSourceKeys}
              onClear={onClearSourceFilter}
              onToggle={onToggleSourceFilter}
            />
          )}
          {sortMode && onSortModeChange && (
            <SortModeMenu value={sortMode} onChange={onSortModeChange} />
          )}
        </div>
      </div>
    </header>
  );
}
