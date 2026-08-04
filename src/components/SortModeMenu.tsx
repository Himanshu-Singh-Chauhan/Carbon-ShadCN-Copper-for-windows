import {
  SortByDown01Icon,
  SortByUp01Icon,
  Sorting01Icon,
} from "@hugeicons/core-free-icons";
import type { NoteSortMode } from "../lib/model";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Icon, type IconData } from "./ui/icon";

const modes: Array<{
  value: NoteSortMode;
  label: string;
  description: string;
  icon: IconData;
}> = [
  {
    value: "manual",
    label: "Manual",
    description: "Drag to reorder",
    icon: Sorting01Icon,
  },
  {
    value: "created-desc",
    label: "Newest",
    description: "Date added, descending",
    icon: SortByDown01Icon,
  },
  {
    value: "created-asc",
    label: "Oldest",
    description: "Date added, ascending",
    icon: SortByUp01Icon,
  },
];

export function SortModeMenu({
  value,
  onChange,
}: {
  value: NoteSortMode;
  onChange: (value: NoteSortMode) => void;
}) {
  const active = modes.find((mode) => mode.value === value) ?? modes[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface-raised px-2 text-xs font-medium text-muted shadow-sm outline-none transition-colors hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35"
          aria-label={`Sort notes. Currently ${active.label}`}
          title={`Sort: ${active.label}`}
        >
          <Icon className="shrink-0" icon={active.icon} size={13} />
          <span className="truncate max-[440px]:hidden">{active.label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-52">
        <DropdownMenuLabel>Sort notes</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(nextValue) => onChange(nextValue as NoteSortMode)}
        >
          {modes.map((mode) => (
            <DropdownMenuRadioItem
              indicatorSide="right"
              key={mode.value}
              value={mode.value}
            >
              <Icon icon={mode.icon} size={15} />
              <span className="min-w-0">
                <span className="block text-sm">{mode.label}</span>
                <span className="block text-xs text-faint">
                  {mode.description}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
