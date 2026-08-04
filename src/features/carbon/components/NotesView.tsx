import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useEffect, useState, type MouseEvent } from "react";
import type {
  CarbonItem,
  CarbonSection,
  NoteSortMode,
} from "../../../lib/model";
import { NoteSectionGroup } from "./notes-view/NoteSectionGroup";
import {
  NoSearchResults,
  NotesEmptyState,
} from "./notes-view/NotesEmptyState";

export type NotesViewProps = {
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
};

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
}: NotesViewProps) {
  const [now, setNow] = useState(() => Date.now());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  let content;
  if (itemCount === 0 && !query) {
    content = (
      <NotesEmptyState
        captureHotkey={captureHotkey}
        captureReady={captureReady}
        onFocusInput={onFocusInput}
        onOpenCommands={onOpenCommands}
      />
    );
  } else if (visibleSections.length === 0) {
    content = <NoSearchResults onClear={onClearQuery} />;
  } else {
    content = (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <div className="grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)] gap-5">
          {visibleSections.map((section) => (
            <NoteSectionGroup
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
              dragDisabled={Boolean(query) || section.sortMode !== "manual"}
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
    );
  }

  return (
    <section
      className="min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto px-3 pb-4 pt-1 [scrollbar-color:var(--line-strong)_transparent] [scrollbar-width:thin]"
      aria-label="Carbon notes"
      data-notes-scroll
    >
      {content}
    </section>
  );
}
