import {
  AppWindowIcon,
  ArrowUpRight01Icon,
  BrowserIcon,
} from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useState } from "react";
import type { CarbonItemSource } from "../lib/model";
import { openExternalUrl, readAppSourceIcon } from "../lib/native";
import { Icon } from "./ui/icon";

const sourceIconRequests = new Map<string, Promise<Uint8Array>>();

function loadSourceIcon(path: string) {
  let request = sourceIconRequests.get(path);
  if (!request) {
    request = readAppSourceIcon(path);
    sourceIconRequests.set(path, request);
  }
  return request;
}

function sourceHostname(url: string | undefined) {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return undefined;
  }
}

export function SourceIcon({ source }: { source: CarbonItemSource }) {
  const [iconUrl, setIconUrl] = useState<string>();

  useEffect(() => {
    if (!source.iconPath) {
      setIconUrl(undefined);
      return;
    }
    let disposed = false;
    let objectUrl: string | undefined;
    void loadSourceIcon(source.iconPath)
      .then((bytes) => {
        if (disposed || bytes.length === 0) return;
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
        setIconUrl(objectUrl);
      })
      .catch(() => {
        if (!disposed) setIconUrl(undefined);
      });
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source.iconPath]);

  if (iconUrl) {
    return (
      <img
        className="size-4 shrink-0 object-contain"
        src={iconUrl}
        alt=""
        draggable={false}
      />
    );
  }

  return (
    <Icon
      className="shrink-0 text-faint"
      icon={source.pageUrl ? BrowserIcon : AppWindowIcon}
      size={16}
    />
  );
}

export function ItemSourceBadge({ source }: { source: CarbonItemSource }) {
  const hostname = useMemo(
    () => sourceHostname(source.pageUrl),
    [source.pageUrl],
  );
  const title = source.pageTitle?.trim() || source.appName;
  const detail = hostname
    ? `${source.appName} · ${hostname}`
    : source.pageTitle
      ? source.appName
      : undefined;
  const content = (
    <>
      <SourceIcon source={source} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-muted">
          {title}
        </span>
        {detail && (
          <span className="mt-0.5 block truncate text-xs text-faint">
            {detail}
          </span>
        )}
      </span>
      {source.pageUrl && (
        <Icon
          className="shrink-0 text-faint"
          icon={ArrowUpRight01Icon}
          size={13}
        />
      )}
    </>
  );

  if (!source.pageUrl) {
    return (
      <div
        className="mt-2 flex min-w-0 max-w-full items-center gap-2 overflow-hidden border-t border-line/70 pt-2"
        title={`Captured from ${source.appName}`}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="mt-2 flex w-full min-w-0 max-w-full cursor-pointer items-center gap-2 overflow-hidden border-t border-line/70 pt-2 text-left outline-none hover:[&_*]:text-ink focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-accent/35"
      title={`Open ${title}`}
      aria-label={`Open ${title}`}
      onClick={(event) => {
        event.stopPropagation();
        void openExternalUrl(source.pageUrl!);
      }}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {content}
    </button>
  );
}
