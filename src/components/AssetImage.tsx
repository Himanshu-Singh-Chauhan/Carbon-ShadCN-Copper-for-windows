import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { useNearViewport } from "../hooks/useNearViewport";
import type { CarbonAttachment } from "../lib/model";
import { readImageAsset } from "../lib/native";

export function useAssetUrl(
  attachment: CarbonAttachment | undefined,
  enabled = true,
) {
  const [url, setUrl] = useState<string>();
  const path = attachment?.path;
  const mimeType = attachment?.mimeType;

  useEffect(() => {
    setUrl(undefined);
    if (!attachment || !enabled) {
      return;
    }
    if (/^(blob:|data:)/.test(path ?? "")) {
      setUrl(path);
      return;
    }

    let disposed = false;
    let objectUrl: string | undefined;
    readImageAsset(path ?? "")
      .then((bytes) => {
        if (disposed) return;
        objectUrl = URL.createObjectURL(
          new Blob([bytes], { type: mimeType }),
        );
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!disposed) setUrl(undefined);
      });

    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [enabled, mimeType, path]);

  return url;
}

export function AssetImage({
  attachment,
  ...props
}: { attachment: CarbonAttachment } & Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src"
>) {
  const { nearViewport, observe } = useNearViewport<HTMLElement>();
  const url = useAssetUrl(attachment, nearViewport);
  if (!url) {
    return (
      <span
        ref={observe}
        className={`block h-full w-full bg-surface-hover ${
          nearViewport ? "animate-pulse" : ""
        }`}
        aria-hidden="true"
      />
    );
  }
  return (
    <img
      {...props}
      ref={observe}
      src={url}
      loading="lazy"
      decoding="async"
    />
  );
}
