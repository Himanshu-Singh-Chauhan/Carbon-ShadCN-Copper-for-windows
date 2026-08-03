import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";
import {
  getLinkPreview,
  openExternalUrl,
  readLinkPreviewImage,
  type LinkPreviewPayload,
} from "../lib/native";
import { Icon } from "./ui/icon";

export function LinkPreviewCard({ url }: { url: string }) {
  const [preview, setPreview] = useState<LinkPreviewPayload | null>(null);
  const [imageUrl, setImageUrl] = useState<string>();

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | undefined;

    void getLinkPreview(url).then(async (value) => {
      if (disposed || !value) return;
      setPreview(value);
      if (!value.imagePath || !value.imageMimeType) return;
      try {
        const bytes = await readLinkPreviewImage(value.imagePath);
        if (disposed) return;
        objectUrl = URL.createObjectURL(
          new Blob([bytes], { type: value.imageMimeType }),
        );
        setImageUrl(objectUrl);
      } catch {
        // Metadata remains useful if a cached image becomes unavailable.
      }
    });

    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (!preview) return null;

  return (
    <button
      type="button"
      className="mt-2 block w-full cursor-pointer overflow-hidden rounded-xl border border-line bg-surface text-left outline-none transition-[border-color,background-color] hover:border-line-strong hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent/35"
      onClick={(event) => {
        event.stopPropagation();
        void openExternalUrl(preview.url);
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      aria-label={`Open ${preview.title}`}
    >
      {imageUrl && (
        <img
          className="aspect-video max-h-44 w-full bg-surface-hover object-cover"
          src={imageUrl}
          alt=""
          draggable={false}
        />
      )}
      <span className="block px-3 py-2.5">
        <span className="flex items-center gap-2 text-xs font-medium text-muted">
          <span className="min-w-0 flex-1 truncate">{preview.siteName}</span>
          <Icon className="shrink-0 text-faint" icon={ArrowUpRight01Icon} size={13} />
        </span>
        <strong className="mt-1 block text-sm font-semibold leading-5 text-ink">
          {preview.title}
        </strong>
        {preview.description && (
          <span className="mt-1 block max-h-10 overflow-hidden text-xs leading-5 text-muted">
            {preview.description}
          </span>
        )}
      </span>
    </button>
  );
}
