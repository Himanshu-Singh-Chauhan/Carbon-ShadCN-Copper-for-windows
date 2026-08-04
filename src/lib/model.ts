import { createId } from "./utils";

export type Theme = "light" | "dark";
export type NoteSortMode = "manual" | "created-desc" | "created-asc";
export type DoubleClickAction = "copy" | "edit";
export type CapturePlacement = "top" | "bottom";

export interface CarbonAttachment {
  id: string;
  path: string;
  mimeType: string;
  width: number;
  height: number;
}

export interface CarbonItemSource {
  id: string;
  appName: string;
  iconPath?: string;
  pageTitle?: string;
  pageUrl?: string;
}

export interface CarbonItem {
  id: string;
  text: string;
  attachments: CarbonAttachment[];
  source?: CarbonItemSource;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CarbonSection {
  id: string;
  name: string;
  sortMode: NoteSortMode;
  items: CarbonItem[];
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CarbonSettings {
  theme: Theme;
  alwaysOnTop: boolean;
  showLinkPreviews: boolean;
  showCreatedAt: boolean;
  showItemSources: boolean;
  doubleClickAction: DoubleClickAction;
  capturePlacement: CapturePlacement;
  captureHotkey: string;
  showWindowHotkey: string;
  windowBounds?: WindowBounds;
}

export interface CarbonDocument {
  version: 2;
  activeSectionId: string;
  sections: CarbonSection[];
  settings: CarbonSettings;
}

export const ALL_SECTIONS = "all";

function normalizeTimestamp(value: unknown, fallback: string) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? value
    : fallback;
}

export function createDefaultDocument(): CarbonDocument {
  const inboxId = createId("section");
  return {
    version: 2,
    activeSectionId: ALL_SECTIONS,
    sections: [
      { id: inboxId, name: "Inbox", sortMode: "manual", items: [] },
    ],
    settings: {
      theme: "light",
      alwaysOnTop: true,
      showLinkPreviews: true,
      showCreatedAt: true,
      showItemSources: true,
      doubleClickAction: "copy",
      capturePlacement: "top",
      captureHotkey: "CommandOrControl+Shift+C",
      showWindowHotkey: "CommandOrControl+Shift+Space",
    },
  };
}

export function normalizeDocument(value: unknown): CarbonDocument {
  const fallback = createDefaultDocument();
  if (!value || typeof value !== "object") return fallback;

  const input = value as Partial<CarbonDocument>;
  const migrationTimestamp = new Date().toISOString();
  const sections: CarbonSection[] = Array.isArray(input.sections)
    ? input.sections
        .filter(
          (section): section is CarbonSection =>
            Boolean(
              section &&
                typeof section.id === "string" &&
                typeof section.name === "string",
            ),
        )
        .map((section): CarbonSection => ({
          id: section.id,
          name: section.name,
          sortMode:
            section.sortMode === "created-desc" ||
            section.sortMode === "created-asc"
              ? section.sortMode
              : "manual",
          items: Array.isArray(section.items)
            ? section.items
                .filter(
                  (item) =>
                  item &&
                  typeof item.id === "string" &&
                  typeof item.text === "string",
                )
                .map((item): CarbonItem => {
                  const createdAt = normalizeTimestamp(
                    item.createdAt,
                    normalizeTimestamp(item.updatedAt, migrationTimestamp),
                  );
                  return {
                    ...item,
                    completed: Boolean(item.completed),
                    createdAt,
                    updatedAt: normalizeTimestamp(item.updatedAt, createdAt),
                    attachments: Array.isArray(item.attachments)
                      ? item.attachments.filter(
                          (attachment): attachment is CarbonAttachment =>
                            Boolean(
                              attachment &&
                                typeof attachment.id === "string" &&
                                typeof attachment.path === "string" &&
                                typeof attachment.mimeType === "string" &&
                                typeof attachment.width === "number" &&
                                typeof attachment.height === "number",
                            ),
                        )
                      : [],
                    source:
                      item.source &&
                      typeof item.source === "object" &&
                      typeof item.source.id === "string" &&
                      typeof item.source.appName === "string"
                        ? {
                            id: item.source.id,
                            appName: item.source.appName,
                            ...(typeof item.source.iconPath === "string"
                              ? { iconPath: item.source.iconPath }
                              : {}),
                            ...(typeof item.source.pageTitle === "string"
                              ? { pageTitle: item.source.pageTitle }
                              : {}),
                            ...(typeof item.source.pageUrl === "string" &&
                            /^https?:\/\//i.test(item.source.pageUrl)
                              ? { pageUrl: item.source.pageUrl }
                              : {}),
                          }
                        : undefined,
                  };
                })
            : [],
        }))
    : fallback.sections;

  if (sections.length === 0) sections.push(...fallback.sections);

  const activeSectionId =
    input.activeSectionId === ALL_SECTIONS ||
    sections.some((section) => section.id === input.activeSectionId)
      ? input.activeSectionId!
      : ALL_SECTIONS;

  return {
    version: 2,
    activeSectionId,
    sections,
    settings: {
      ...fallback.settings,
      ...(input.settings ?? {}),
      theme: input.settings?.theme === "dark" ? "dark" : "light",
      showLinkPreviews: input.settings?.showLinkPreviews !== false,
      showCreatedAt: input.settings?.showCreatedAt !== false,
      showItemSources: input.settings?.showItemSources !== false,
      doubleClickAction:
        input.settings?.doubleClickAction === "edit" ? "edit" : "copy",
      capturePlacement:
        input.settings?.capturePlacement === "bottom" ? "bottom" : "top",
      captureHotkey:
        typeof input.settings?.captureHotkey === "string" &&
        input.settings.captureHotkey.trim()
          ? input.settings.captureHotkey
          : fallback.settings.captureHotkey,
      showWindowHotkey:
        typeof input.settings?.showWindowHotkey === "string" &&
        input.settings.showWindowHotkey.trim()
          ? input.settings.showWindowHotkey
          : fallback.settings.showWindowHotkey,
    },
  };
}
