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
  onTaskToggle,
}: {
  markdown: string;
  query?: string;
  completed?: boolean;
  onTaskToggle?: (taskIndex: number, checked: boolean) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let disposed = false;
    const fallback = document.createElement("p");
    fallback.className = "min-w-0";
    fallback.textContent = markdown;
    root.replaceChildren(fallback);
    const displayMarkdown = normalizeMarkdownForRendering(markdown);

    void getMarkdownRenderer()
      .then((renderer) => {
        if (disposed) return;
        const content = renderer.render(displayMarkdown);
        root.replaceChildren(content);
        root
          .querySelectorAll<HTMLInputElement>(
            'input[data-markdown-task-index]',
          )
          .forEach((checkbox) => {
            checkbox.disabled = !onTaskToggle;
          });
        highlightMarkdownMatches(root, query);
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) {
          console.error("Failed to render Markdown.", error);
        }
      });

    return () => {
      disposed = true;
    };
  }, [markdown, query, Boolean(onTaskToggle)]);

  return (
    <div
      ref={rootRef}
      className={cn(
        MARKDOWN_CONTENT_CLASSNAME,
        completed && "line-through decoration-faint/70",
      )}
      onClick={(event) => {
        const target = event.target;
        if (
          target instanceof HTMLInputElement &&
          target.matches('input[data-markdown-task-index]')
        ) {
          event.stopPropagation();
          const taskIndex = Number(target.dataset.markdownTaskIndex);
          if (!onTaskToggle || !Number.isInteger(taskIndex)) {
            event.preventDefault();
            return;
          }
          onTaskToggle(taskIndex, target.checked);
          return;
        }
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
          event.target.closest(
            'a[href], input[data-markdown-task-index]',
          )
        ) {
          event.stopPropagation();
        }
      }}
    />
  );
}
