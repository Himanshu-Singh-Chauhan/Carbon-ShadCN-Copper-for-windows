import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Calendar01Icon, BucketIcon } from "@hugeicons/core-free-icons";
import type { MouseEvent } from "react";
import { CarbonItemRow } from "../../../../components/CarbonItemRow";
import { SortModeMenu } from "../../../../components/SortModeMenu";
import { Icon } from "../../../../components/ui/icon";
import { formatCreatedAtGroup } from "../../../../lib/dates";
import type {
  CarbonItem,
  CarbonSection,
  NoteSortMode,
} from "../../../../lib/model";
import { cn } from "../../../../lib/utils";

type NoteSectionGroupProps = {
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
  onEdit: (item: CarbonItem, forceEdit?: boolean) => void;
  onOpenImage: (item: CarbonItem, index: number) => void;
  onSortModeChange: (sectionId: string, sortMode: NoteSortMode) => void;
  onTaskToggle: (
    item: CarbonItem,
    taskIndex: number,
    checked: boolean,
  ) => void;
};

function groupItemsByCreatedAt(section: CarbonSection, now: number) {
  if (section.sortMode === "manual") {
    return [{ label: null, items: section.items }];
  }

  return section.items.reduce<
    Array<{ label: string | null; items: CarbonItem[] }>
  >((groups, item) => {
    const label = formatCreatedAtGroup(item.createdAt, now);
    const previous = groups[groups.length - 1];
    if (previous?.label === label) {
      previous.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
    return groups;
  }, []);
}

export function NoteSectionGroup({
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
  onTaskToggle,
}: NoteSectionGroupProps) {
  const itemGroups = groupItemsByCreatedAt(section, now);

  return (
    <section className="relative min-w-0 max-w-full">
      {showHeader && (
        <div
          className="sticky top-[-4px] z-10 -mx-1 mb-2 flex items-center gap-2 bg-canvas px-1 py-1.5"
          data-note-sticky-surface
        >
          <div className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-line bg-surface-raised px-2 py-1 text-xs font-semibold text-muted shadow-sm">
            <Icon
              className="shrink-0 text-faint"
              icon={BucketIcon}
              size={13}
            />
            <span className="truncate">{section.name}</span>
            <span className="tabular-nums text-faint">{section.items.length}</span>
          </div>
          <div className="flex-1" />
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
        <div className="grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)] gap-3">
          {itemGroups.map((group) => (
            <div
              className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2"
              key={group.label ?? "manual"}
            >
              {group.label && (
                <div
                  className={cn(
                    "sticky z-[9] -mx-1 flex min-w-0 items-center gap-2 bg-canvas px-1 py-1",
                    showHeader ? "top-[30px]" : "top-[-4px]"
                  )}
                  data-note-sticky-surface
                >
                  <div className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-line bg-surface-raised/90 px-2.5 py-0.5 text-[11px] font-semibold text-muted shadow-xs backdrop-blur-xs">
                    <Icon
                      className="shrink-0 text-accent/70"
                      icon={Calendar01Icon}
                      size={12}
                    />
                    <span className="truncate tracking-tight">{group.label}</span>
                    <span className="ml-0.5 rounded-full border border-line/60 bg-surface px-1.5 py-0.2 text-[10px] font-medium tabular-nums text-faint">
                      {group.items.length}
                    </span>
                  </div>
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
                  onEdit={(forceEdit) => onEdit(item, forceEdit)}
                  onOpenImage={(index) => onOpenImage(item, index)}
                  onTaskToggle={(taskIndex, checked) =>
                    onTaskToggle(item, taskIndex, checked)
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </SortableContext>
    </section>
  );
}
