import {
  defaultValueCtx,
  Editor,
  editorViewOptionsCtx,
  parserCtx,
  rootCtx,
  schemaCtx,
} from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import { DOMSerializer } from "@milkdown/kit/prose/model";
import {
  blockquoteAttr,
  bulletListAttr,
  codeBlockAttr,
  emphasisAttr,
  headingAttr,
  hrAttr,
  imageAttr,
  inlineCodeAttr,
  linkAttr,
  listItemAttr,
  orderedListAttr,
  paragraphAttr,
  strongAttr,
  commonmark,
} from "@milkdown/kit/preset/commonmark";
import { gfm, strikethroughAttr } from "@milkdown/kit/preset/gfm";

export const markdownPlugins = [...commonmark, ...gfm];

export const MARKDOWN_CONTENT_CLASSNAME =
  "min-w-0 max-w-full text-sm leading-[1.55] text-ink [overflow-wrap:anywhere] " +
  "[&_.ProseMirror]:min-h-6 [&_.ProseMirror]:max-h-32 [&_.ProseMirror]:overflow-y-auto [&_.ProseMirror]:outline-none " +
  "[&_p]:my-0 [&_p]:whitespace-pre-wrap [&_p+p]:mt-2 [&_h1]:my-2 [&_h1]:text-sm [&_h1]:font-bold [&_h2]:my-2 [&_h2]:text-sm [&_h2]:font-bold " +
  "[&_h3]:my-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h4]:my-1.5 [&_h4]:text-sm [&_h4]:font-semibold " +
  "[&_h5]:my-1 [&_h5]:text-sm [&_h5]:font-semibold [&_h6]:my-1 [&_h6]:text-sm [&_h6]:font-semibold " +
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 " +
  "[&_li[data-item-type=task]]:flex [&_li[data-item-type=task]]:list-none [&_li[data-item-type=task]]:items-start [&_li[data-item-type=task]]:gap-2 " +
  "[&_li[data-item-type=task]>input]:mt-1 [&_li[data-item-type=task]>input]:size-3.5 [&_li[data-item-type=task]>input]:shrink-0 [&_li[data-item-type=task]>input]:cursor-pointer [&_li[data-item-type=task]>input]:accent-accent [&_li[data-item-type=task]>input]:disabled:cursor-default [&_li[data-item-type=task]>input]:disabled:opacity-100 " +
  "[&_li[data-item-type=task]>p]:min-w-0 [&_li[data-item-type=task]>p]:flex-1 " +
  "[&_li[data-item-type=task][data-checked=true]>p]:text-muted [&_li[data-item-type=task][data-checked=true]>p]:line-through " +
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-line-strong [&_blockquote]:pl-3 [&_blockquote]:text-muted " +
  "[&_pre]:my-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-line [&_pre]:bg-surface [&_pre]:p-2.5 [&_pre]:text-xs " +
  "[&_code]:rounded [&_code]:bg-surface [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
  "[&_a]:cursor-pointer [&_a]:text-accent [&_a]:underline [&_a]:decoration-accent/35 [&_a]:underline-offset-2 hover:[&_a]:decoration-accent " +
  "[&_hr]:my-3 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-line [&_strong]:font-semibold [&_img]:hidden " +
  "[&_table]:my-2 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse " +
  "[&_th]:border [&_th]:border-line [&_th]:bg-surface [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold " +
  "[&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1";

export function configureMarkdown(ctx: Ctx) {
  ctx.set(paragraphAttr.key, () => ({ class: "min-w-0" }));
  ctx.set(headingAttr.key, () => ({ class: "min-w-0" }));
  ctx.set(blockquoteAttr.key, () => ({ class: "min-w-0" }));
  ctx.set(codeBlockAttr.key, () => ({
    pre: { class: "min-w-0" },
    code: {},
  }));
  ctx.set(hrAttr.key, () => ({ class: "min-w-0" }));
  ctx.set(imageAttr.key, () => ({
    class: "hidden",
    "aria-hidden": "true",
  }));
  ctx.set(bulletListAttr.key, () => ({ class: "min-w-0" }));
  ctx.set(orderedListAttr.key, () => ({ class: "min-w-0" }));
  ctx.set(listItemAttr.key, () => ({ class: "min-w-0" }));
  ctx.set(emphasisAttr.key, () => ({ class: "italic" }));
  ctx.set(strongAttr.key, () => ({ class: "font-semibold" }));
  ctx.set(inlineCodeAttr.key, () => ({ class: "font-mono" }));
  ctx.set(linkAttr.key, () => ({
    class: "text-accent underline",
    rel: "noreferrer",
  }));
  ctx.set(strikethroughAttr.key, () => ({ class: "line-through" }));
}

type MarkdownRenderer = {
  render: (markdown: string) => DocumentFragment;
};

let rendererPromise: Promise<MarkdownRenderer> | undefined;

function createRenderer() {
  const root = document.createElement("div");
  return Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, "");
      ctx.set(editorViewOptionsCtx, { editable: () => false });
      configureMarkdown(ctx);
    })
    .use(markdownPlugins)
    .create()
    .then((editor): MarkdownRenderer => ({
      render: (markdown) =>
        editor.action((ctx) => {
          const doc = ctx.get(parserCtx)(markdown);
          const fragment = document.createDocumentFragment();
          if (!doc) return fragment;

          const rendered = DOMSerializer.fromSchema(
            ctx.get(schemaCtx),
          ).serializeFragment(doc.content);
          rendered.querySelectorAll("img").forEach((image) => image.remove());
          rendered.querySelectorAll("a").forEach((link) => {
            link.setAttribute("draggable", "false");
            link.setAttribute("rel", "noreferrer");
          });
          rendered
            .querySelectorAll<HTMLLIElement>('li[data-item-type="task"]')
            .forEach((item, index) => {
              const checkbox = document.createElement("input");
              checkbox.type = "checkbox";
              checkbox.checked = item.dataset.checked === "true";
              checkbox.dataset.markdownTaskIndex = String(index);
              checkbox.setAttribute(
                "aria-label",
                checkbox.checked ? "Mark task not done" : "Mark task done",
              );
              item.prepend(checkbox);
            });
          fragment.append(rendered);
          return fragment;
        }),
    }));
}

export function getMarkdownRenderer() {
  rendererPromise ??= createRenderer();
  return rendererPromise;
}

export function normalizeMarkdownForRendering(markdown: string) {
  const normalized = markdown.replace(/\r\n?|\u2028|\u2029/g, "\n");
  const capturedMultilineFence = normalized.match(
    /^\s*```[^\S\n]*([A-Za-z0-9_+-]*)[^\S\n]*\n([\s\S]*?)\n[^\S\n]*```\s*$/,
  );
  if (capturedMultilineFence) {
    const [, language, code] = capturedMultilineFence;
    return `\`\`\`${language}\n${code}\n\`\`\``;
  }

  const capturedSingleLineFence = normalized.match(
    /^\s*```[^\S\n]*([A-Za-z0-9_+-]*)[^\S\n]+(.+?)[^\S\n]+```\s*$/,
  );
  if (capturedSingleLineFence) {
    const [, language, code] = capturedSingleLineFence;
    return `\`\`\`${language}\n${code.trim()}\n\`\`\``;
  }

  if (!normalized.includes("\n")) {
    const visualItems = normalized.split(/\s+[•·]\s+/);
    if (visualItems.length >= 3 && visualItems.every((item) => item.trim())) {
      return visualItems.map((item) => `- ${item.trim()}`).join("\n");
    }
  }
  return normalized.replace(/^(\s*)[•·]\s+/gm, "$1- ");
}

export function setMarkdownTaskChecked(
  markdown: string,
  taskIndex: number,
  checked: boolean,
) {
  let currentIndex = -1;
  return markdown.replace(
    /^(\s*(?:(?:[-+*])|(?:\d+[.)]))\s+\[)([ xX])(\])/gm,
    (match, before: string, _state: string, after: string) => {
      currentIndex += 1;
      return currentIndex === taskIndex
        ? `${before}${checked ? "x" : " "}${after}`
        : match;
    },
  );
}

export function highlightMarkdownMatches(root: HTMLElement, query: string) {
  const needle = query.trim();
  if (!needle) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  const matcher = new RegExp(
    `(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  for (const node of nodes) {
    if (!node.data.toLowerCase().includes(needle.toLowerCase())) continue;
    const parts = node.data.split(matcher);
    const replacement = document.createDocumentFragment();
    parts.forEach((part) => {
      if (part.toLowerCase() === needle.toLowerCase()) {
        const mark = document.createElement("mark");
        mark.className = "rounded bg-accent-soft px-0.5 text-ink";
        mark.textContent = part;
        replacement.append(mark);
      } else {
        replacement.append(document.createTextNode(part));
      }
    });
    node.replaceWith(replacement);
  }
}
