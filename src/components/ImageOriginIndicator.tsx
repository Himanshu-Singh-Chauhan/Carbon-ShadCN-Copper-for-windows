import { LinkSquare02Icon } from "@hugeicons/core-free-icons";
import type { MouseEvent } from "react";
import type { CarbonImageOrigin } from "../lib/model";
import { openExternalUrl } from "../lib/native";
import { cn } from "../lib/utils";
import { Icon } from "./ui/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";

export function ImageOriginIndicator({
  className,
  origin,
}: {
  className?: string;
  origin: CarbonImageOrigin;
}) {
  const url = origin.pageUrl ?? origin.sourceUrl;
  if (!url) return null;

  function openOrigin(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    void openExternalUrl(url!);
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "absolute inline-flex size-5 cursor-pointer items-center justify-center rounded-md border border-white/20 bg-black/65 text-white shadow-sm outline-none backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white/70",
            className,
          )}
          aria-label="Open image source"
          onClick={openOrigin}
          onDoubleClick={(event) => event.stopPropagation()}
          data-no-item-drag
        >
          <Icon icon={LinkSquare02Icon} size={12} />
        </button>
      </TooltipTrigger>
      <TooltipContent className="break-all" side="top">
        {url}
      </TooltipContent>
    </Tooltip>
  );
}
