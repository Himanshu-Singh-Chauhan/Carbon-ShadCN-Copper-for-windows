import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";
import { useNearViewport } from "../hooks/useNearViewport";
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
  const { nearViewport, observe } = useNearViewport<HTMLElement>();

  useEffect(() => {
    setPreview(null);
    setImageUrl(undefined);
  }, [url]);

  useEffect(() => {
    if (!nearViewport || preview) return;
    let disposed = false;

    void getLinkPreview(url).then((value) => {
      if (disposed || !value) return;
      setPreview(value);
    });

    return () => {
      disposed = true;
    };
  }, [nearViewport, preview, url]);

  useEffect(() => {
    setImageUrl(undefined);
    if (
      !nearViewport ||
      !preview?.imagePath ||
      !preview.imageMimeType
    ) {
      return;
    }

    let disposed = false;
    let objectUrl: string | undefined;
    void readLinkPreviewImage(preview.imagePath)
      .then((bytes) => {
        if (disposed) return;
        objectUrl = URL.createObjectURL(
          new Blob([bytes], { type: preview.imageMimeType }),
        );
        setImageUrl(objectUrl);
      })
      .catch(() => {
        // Metadata remains useful if a cached image becomes unavailable.
      });

    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    nearViewport,
    preview?.imageMimeType,
    preview?.imagePath,
  ]);

  if (!preview) {
    return (
      <span
        ref={observe}
        className="block h-px w-full"
        aria-hidden="true"
      />
    );
  }

  return (
    <button
      ref={observe}
      type="button"
      className="mt-2 block w-full min-w-0 max-w-full cursor-pointer overflow-hidden rounded-xl border border-line bg-surface text-left outline-none transition-[border-color,background-color] hover:border-line-strong hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent/35"
      onClick={(event) => {
        event.stopPropagation();
        void openExternalUrl(preview.url);
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      aria-label={`Open ${preview.title}`}
    >
      {preview.imagePath && (
        imageUrl ? (
          <img
            className="aspect-video max-h-44 w-full max-w-full bg-surface-hover object-cover"
            src={imageUrl}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span
            className={`block aspect-video max-h-44 w-full bg-surface-hover ${
              nearViewport ? "animate-pulse" : ""
            }`}
            aria-hidden="true"
          />
        )
      )}
      <span className="block px-3 py-2.5">
        <span className="flex items-center gap-2 text-xs font-medium text-muted">
          <span className="min-w-0 flex-1 truncate">{preview.siteName}</span>
          <Icon className="shrink-0 text-faint" icon={ArrowUpRight01Icon} size={13} />
        </span>
        <strong className="mt-1 block max-w-full [overflow-wrap:anywhere] text-sm font-semibold leading-5 text-ink">
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
