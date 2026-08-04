import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Drag01Icon,
  Folder02Icon,
  Search01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { useEffect, useState, type MouseEvent } from "react";
import { CarbonItemRow } from "../../../components/CarbonItemRow";
import { SortModeMenu } from "../../../components/SortModeMenu";
import { Button } from "../../../components/ui/button";
import { Icon } from "../../../components/ui/icon";
import { formatCreatedAtGroup } from "../../../lib/dates";
import type {
  CarbonItem,
  CarbonSection,
  NoteSortMode,
} from "../../../lib/model";

export function NotesView({
  captureHotkey,
  captureReady,
  focusedItemId,
  itemCount,
  query,
  showCreatedAt,
  showItemSources,
  showLinkPreviews,
  showSectionHeaders,
  selectedIds,
  visibleSections,
  onClearQuery,
  onContextMenu,
  onDragEnd,
  onEdit,
  onFocusInput,
  onOpenCommands,
  onOpenImage,
  onSelect,
  onSortModeChange,
  onToggle,
}: {
  captureHotkey: string;
  captureReady: boolean;
  focusedItemId: string | null;
  itemCount: number;
  query: string;
  showCreatedAt: boolean;
  showItemSources: boolean;
  showLinkPreviews: boolean;
  showSectionHeaders: boolean;
  selectedIds: string[];
  visibleSections: CarbonSection[];
  onClearQuery: () => void;
  onContextMenu: (event: MouseEvent, itemId: string) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onEdit: (item: CarbonItem) => void;
  onFocusInput: () => void;
  onOpenCommands: () => void;
  onOpenImage: (item: CarbonItem, index: number) => void;
  onSelect: (itemId: string, event: MouseEvent) => void;
  onSortModeChange: (sectionId: string, sortMode: NoteSortMode) => void;
  onToggle: (itemId: string) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section
      className="min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto px-3 pb-4 pt-1 [scrollbar-color:var(--line-strong)_transparent] [scrollbar-width:thin]"
      aria-label="Carbon notes"
      data-notes-scroll
    >
      {itemCount === 0 && !query ? (
        <EmptyState
          captureHotkey={captureHotkey}
          captureReady={captureReady}
          onFocusInput={onFocusInput}
          onOpenCommands={onOpenCommands}
        />
      ) : visibleSections.length === 0 ? (
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
          <Button variant="outline" size="sm" onClick={onClearQuery}>
            Clear search
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <div className="grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)] gap-5">
            {visibleSections.map((section) => (
              <SectionGroup
                key={section.id}
                section={section}
                query={query}
                focusedItemId={focusedItemId}
                selectedIds={selectedIds}
                showHeader={showSectionHeaders}
                showCreatedAt={showCreatedAt}
                showItemSources={showItemSources}
                showLinkPreviews={showLinkPreviews}
                now={now}
                dragDisabled={
                  Boolean(query) || section.sortMode !== "manual"
                }
                onToggle={onToggle}
                onSelect={onSelect}
                onContextMenu={onContextMenu}
                onEdit={onEdit}
                onOpenImage={onOpenImage}
                onSortModeChange={onSortModeChange}
              />
            ))}
          </div>
        </DndContext>
      )}
    </section>
  );
}

function SectionGroup({
  section,
  query,
  focusedItemId,
  selectedIds,
  showHeader,
  showCreatedAt,
  showItemSources,
  showLinkPreviews,
  now,
  dragDisabled,
  onToggle,
  onSelect,
  onContextMenu,
  onEdit,
  onOpenImage,
  onSortModeChange,
}: {
  section: CarbonSection;
  query: string;
  focusedItemId: string | null;
  selectedIds: string[];
  showHeader: boolean;
  showCreatedAt: boolean;
  showItemSources: boolean;
  showLinkPreviews: boolean;
  now: number;
  dragDisabled: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string, event: MouseEvent) => void;
  onContextMenu: (event: MouseEvent, id: string) => void;
  onEdit: (item: CarbonItem) => void;
  onOpenImage: (item: CarbonItem, index: number) => void;
  onSortModeChange: (sectionId: string, sortMode: NoteSortMode) => void;
}) {
  const itemGroups =
    section.sortMode === "manual"
      ? [{ label: null, items: section.items }]
      : section.items.reduce<Array<{ label: string; items: CarbonItem[] }>>(
          (groups, item) => {
            const label = formatCreatedAtGroup(item.createdAt, now);
            const previous = groups[groups.length - 1];
            if (previous?.label === label) {
              previous.items.push(item);
            } else {
              groups.push({ label, items: [item] });
            }
            return groups;
          },
          [],
        );

  return (
    <section className="relative min-w-0 max-w-full">
      {showHeader && (
        <div className="sticky top-0 z-10 -mx-1 mb-2 flex items-center gap-2 bg-canvas/90 px-1 py-1.5 backdrop-blur-md">
          <div className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-line bg-surface-raised px-2 py-1 text-xs font-semibold text-muted shadow-sm">
            <Icon className="shrink-0 text-faint" icon={Folder02Icon} size={13} />
            <span className="truncate">{section.name}</span>
            <span className="tabular-nums text-faint">{section.items.length}</span>
          </div>
          <div className="h-px flex-1 bg-line" />
          <SortModeMenu
            value={section.sortMode}
            onChange={(sortMode) => onSortModeChange(section.id, sortMode)}
          />
        </div>
      )}
      <SortableContext
        items={section.items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)] gap-4">
          {itemGroups.map((group) => (
            <div
              className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2"
              key={group.label ?? "manual"}
            >
              {group.label && (
                <div className="flex min-w-0 items-center gap-2 px-1 py-0.5">
                  <span className="shrink-0 text-xs font-medium text-faint">
                    {group.label}
                  </span>
                  <div className="h-px flex-1 bg-line/80" />
                </div>
              )}
              {group.items.map((item) => (
                <CarbonItemRow
                  key={item.id}
                  item={item}
                  focused={focusedItemId === item.id}
                  searchQuery={query}
                  selected={selectedIds.includes(item.id)}
                  dragDisabled={dragDisabled}
                  now={now}
                  showCreatedAt={showCreatedAt}
                  showItemSources={showItemSources}
                  showLinkPreviews={showLinkPreviews}
                  onToggle={() => onToggle(item.id)}
                  onSelect={(event) => onSelect(item.id, event)}
                  onContextMenu={(event) => onContextMenu(event, item.id)}
                  onEdit={() => onEdit(item)}
                  onOpenImage={(index) => onOpenImage(item, index)}
                />
              ))}
            </div>
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

function EmptyState({
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
          <kbd className="text-xs font-medium text-faint">
            {captureHotkey}
          </kbd>
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
