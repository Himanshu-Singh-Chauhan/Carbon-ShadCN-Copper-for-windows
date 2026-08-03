import { useEffect, useState, type ImgHTMLAttributes } from "react";
import type { CarbonAttachment } from "../lib/model";
import { readImageAsset } from "../lib/native";

export function useAssetUrl(attachment: CarbonAttachment | undefined) {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (!attachment) {
      setUrl(undefined);
      return;
    }
    if (/^(blob:|data:)/.test(attachment.path)) {
      setUrl(attachment.path);
      return;
    }

    let disposed = false;
    let objectUrl: string | undefined;
    readImageAsset(attachment.path)
      .then((bytes) => {
        if (disposed) return;
        objectUrl = URL.createObjectURL(
          new Blob([bytes], { type: attachment.mimeType }),
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
  }, [attachment]);

  return url;
}

export function AssetImage({
  attachment,
  ...props
}: { attachment: CarbonAttachment } & Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src"
>) {
  const url = useAssetUrl(attachment);
  if (!url) {
    return (
      <span
        className="block h-full w-full animate-pulse bg-surface-hover"
        aria-hidden="true"
      />
    );
  }
  return <img {...props} src={url} />;
}
