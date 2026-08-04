import { useEffect, useRef } from "react";
import {
  getMarkdownRenderer,
  highlightMarkdownMatches,
  MARKDOWN_CONTENT_CLASSNAME,
  normalizeMarkdownForRendering,
} from "../lib/markdown";
import { openExternalUrl } from "../lib/native";
import { cn } from "../lib/utils";

export function MarkdownContent({
  markdown,
  query = "",
  completed = false,
}: {
  markdown: string;
  query?: string;
  completed?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let disposed = false;
    root.textContent = markdown;
    const displayMarkdown = normalizeMarkdownForRendering(markdown);

    void getMarkdownRenderer()
      .then((renderer) => {
        if (disposed) return;
        const content = renderer.render(displayMarkdown);
        root.replaceChildren(content);
        highlightMarkdownMatches(root, query);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
    };
  }, [markdown, query]);

  return (
    <div
      ref={rootRef}
      className={cn(
        MARKDOWN_CONTENT_CLASSNAME,
        completed && "line-through decoration-faint/70",
      )}
      onClick={(event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const link = target.closest<HTMLAnchorElement>("a[href]");
        if (!link) return;
        event.preventDefault();
        event.stopPropagation();
        void openExternalUrl(link.href);
      }}
      onDoubleClick={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest("a[href]")
        ) {
          event.stopPropagation();
        }
      }}
    />
  );
}
