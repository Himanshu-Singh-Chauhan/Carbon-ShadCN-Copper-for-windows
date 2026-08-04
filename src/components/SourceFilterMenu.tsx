import {
  FilterHorizontalIcon,
  FilterResetIcon,
  SourceCodeIcon,
} from "@hugeicons/core-free-icons";
import type { CarbonItemSource } from "../lib/model";
import { SourceIcon } from "./ItemSourceBadge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Icon } from "./ui/icon";

export interface SourceFilterOption {
  key: string;
  label: string;
  count: number;
  description?: string;
  source?: CarbonItemSource;
}

export function SourceFilterMenu({
  options,
  selectedKeys,
  onClear,
  onToggle,
}: {
  options: SourceFilterOption[];
  selectedKeys: string[];
  onClear: () => void;
  onToggle: (key: string) => void;
}) {
  const selected = new Set(selectedKeys);
  const singleSelection =
    selectedKeys.length === 1
      ? options.find((option) => option.key === selectedKeys[0])
      : undefined;
  const label =
    selectedKeys.length === 0
      ? "Sources"
      : singleSelection?.label ?? `${selectedKeys.length} sources`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 min-w-0 max-w-28 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface-raised px-2 text-xs font-medium text-muted shadow-sm outline-none transition-colors hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35"
          aria-label={`Filter notes by source. ${label}`}
          title="Filter by source"
        >
          <Icon className="shrink-0" icon={FilterHorizontalIcon} size={13} />
          <span className="truncate max-[440px]:hidden">{label}</span>
          {selectedKeys.length > 0 && (
            <span className="shrink-0 tabular-nums text-accent">
              {selectedKeys.length}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-72 min-w-60 overflow-y-auto">
        <DropdownMenuLabel>Filter by source</DropdownMenuLabel>
        <DropdownMenuItem disabled={selectedKeys.length === 0} onSelect={onClear}>
          <Icon icon={FilterResetIcon} size={15} />
          All sources
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            checked={selected.has(option.key)}
            indicatorSide="right"
            key={option.key}
            onCheckedChange={() => onToggle(option.key)}
            onSelect={(event) => event.preventDefault()}
          >
            {option.source ? (
              <SourceIcon source={option.source} />
            ) : (
              <Icon icon={SourceCodeIcon} size={15} />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{option.label}</span>
              {option.description && (
                <span className="block truncate text-xs text-faint">
                  {option.description}
                </span>
              )}
            </span>
            <span className="shrink-0 tabular-nums text-faint">
              {option.count}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
