import {
  FilterHorizontalIcon,
  FilterResetIcon,
  SourceCodeIcon,
} from "@hugeicons/core-free-icons";
import type { CarbonItemSource } from "../lib/model";
import { SourceIcon } from "./ItemSourceBadge";
import { cn } from "../lib/utils";
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

  const selectedOptions = selectedKeys
    .map((key) => options.find((option) => option.key === key))
    .filter((opt): opt is SourceFilterOption => !!opt && !!opt.source);

  const hasFilter = selectedKeys.length > 0;
  const buttonIcon =
    selectedOptions.length > 0 ? (
      <span className="scale-[0.8] shrink-0 -m-0.5 inline-flex items-center -space-x-1">
        {selectedOptions.slice(0, 3).map((opt) => (
          <span
            key={opt.key}
            className="inline-flex rounded border border-surface bg-surface-raised p-[0.5px]"
          >
            <SourceIcon source={opt.source!} />
          </span>
        ))}
      </span>
    ) : (
      <Icon className="shrink-0" icon={FilterHorizontalIcon} size={13} />
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-7 min-w-0 max-w-28 cursor-pointer items-center gap-1.5 rounded-lg border px-2 text-xs font-medium shadow-sm outline-none transition-colors",
            hasFilter
              ? "border-accent/35 bg-accent-soft text-ink hover:border-accent/55"
              : "border-line bg-surface-raised text-muted hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35"
          )}
          aria-label={`Filter notes by source. ${label}`}
          title="Filter by source"
        >
          {buttonIcon}
          <span className="truncate max-[440px]:hidden">{label}</span>
          {selectedKeys.length > 1 && (
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
