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
import type { MouseEvent } from "react";
import { CarbonItemRow } from "../../../components/CarbonItemRow";
import { Button } from "../../../components/ui/button";
import { Icon } from "../../../components/ui/icon";
import type {
  CarbonItem,
  CarbonSection,
} from "../../../lib/model";

export function NotesView({
  captureHotkey,
  captureReady,
  focusedItemId,
  itemCount,
  query,
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
  onToggle,
}: {
  captureHotkey: string;
  captureReady: boolean;
  focusedItemId: string | null;
  itemCount: number;
  query: string;
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
  onToggle: (itemId: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return (
    <section
      className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-1 [scrollbar-color:var(--line-strong)_transparent] [scrollbar-width:thin]"
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
          <div className="grid gap-5">
            {visibleSections.map((section) => (
              <SectionGroup
                key={section.id}
                section={section}
                query={query}
                focusedItemId={focusedItemId}
                selectedIds={selectedIds}
                showHeader={showSectionHeaders}
                dragDisabled={Boolean(query)}
                onToggle={onToggle}
                onSelect={onSelect}
                onContextMenu={onContextMenu}
                onEdit={onEdit}
                onOpenImage={onOpenImage}
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
  dragDisabled,
  onToggle,
  onSelect,
  onContextMenu,
  onEdit,
  onOpenImage,
}: {
  section: CarbonSection;
  query: string;
  focusedItemId: string | null;
  selectedIds: string[];
  showHeader: boolean;
  dragDisabled: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string, event: MouseEvent) => void;
  onContextMenu: (event: MouseEvent, id: string) => void;
  onEdit: (item: CarbonItem) => void;
  onOpenImage: (item: CarbonItem, index: number) => void;
}) {
  return (
    <section className="relative">
      {showHeader && (
        <div className="sticky top-0 z-10 -mx-1 mb-2 flex items-center gap-2 bg-canvas/90 px-1 py-1.5 backdrop-blur-md">
          <div className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-line bg-surface-raised px-2 py-1 text-xs font-semibold text-muted shadow-sm">
            <Icon className="shrink-0 text-faint" icon={Folder02Icon} size={13} />
            <span className="truncate">{section.name}</span>
            <span className="tabular-nums text-faint">{section.items.length}</span>
          </div>
          <div className="h-px flex-1 bg-line" />
        </div>
      )}
      <SortableContext
        items={section.items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="grid gap-2">
          {section.items.map((item) => (
            <CarbonItemRow
              key={item.id}
              item={item}
              focused={focusedItemId === item.id}
              searchQuery={query}
              selected={selectedIds.includes(item.id)}
              dragDisabled={dragDisabled}
              onToggle={() => onToggle(item.id)}
              onSelect={(event) => onSelect(item.id, event)}
              onContextMenu={(event) => onContextMenu(event, item.id)}
              onEdit={() => onEdit(item)}
              onOpenImage={(index) => onOpenImage(item, index)}
            />
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
