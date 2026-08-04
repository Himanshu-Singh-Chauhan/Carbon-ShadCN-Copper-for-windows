import {
  ArrowDown01Icon,
  Folder02Icon,
  InboxIcon,
} from "@hugeicons/core-free-icons";
import { ALL_SECTIONS, type CarbonSection } from "../lib/model";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Icon } from "./ui/icon";

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
  const totalItems = buckets.reduce(
    (total, bucket) => total + bucket.items.length,
    0,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 min-w-0 max-w-44 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface-raised px-2 text-xs font-medium text-muted shadow-sm outline-none transition-colors hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35"
          aria-label={`Change bucket. Currently ${activeName}`}
        >
          <Icon className="shrink-0" icon={InboxIcon} size={13} />
          <span className="truncate text-ink">{activeName}</span>
          <span className="shrink-0 tabular-nums text-faint">{itemCount}</span>
          <Icon className="shrink-0 text-faint" icon={ArrowDown01Icon} size={12} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56" align="start">
        <DropdownMenuLabel>Buckets</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={activeBucketId} onValueChange={onSelect}>
          <DropdownMenuRadioItem indicatorSide="right" value={ALL_SECTIONS}>
            <Icon icon={InboxIcon} size={15} />
            <span className="min-w-0 flex-1 truncate">All notes</span>
            <span className="tabular-nums text-faint">{totalItems}</span>
          </DropdownMenuRadioItem>
          {buckets.map((bucket) => (
            <DropdownMenuRadioItem
              indicatorSide="right"
              key={bucket.id}
              value={bucket.id}
            >
              <Icon icon={Folder02Icon} size={15} />
              <span className="min-w-0 flex-1 truncate">{bucket.name}</span>
              <span className="tabular-nums text-faint">
                {bucket.items.length}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
