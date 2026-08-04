import { createId } from "./utils";

export type Theme = "light" | "dark";
export type NoteSortMode = "manual" | "created-desc" | "created-asc";
export type DoneViewMode = "active" | "all" | "done";
export type DoubleClickAction = "copy" | "edit";
export type CapturePlacement = "top" | "bottom";
export type BuiltInAppBackground = "none" | "scenic-flowers";

export interface CustomAppBackground {
  id: string;
  label: string;
  path: string;
  mimeType: string;
}

export interface AppBackgroundPosition {
  x: number;
  y: number;
  zoom: number;
}

export interface CarbonImageOrigin {
  sourceUrl?: string;
  pageUrl?: string;
}

export interface CarbonAttachment extends CarbonImageOrigin {
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
  completedAt?: string;
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
  backgroundImage: string;
  customBackgrounds: CustomAppBackground[];
  backgroundPositions: Record<string, AppBackgroundPosition>;
  backgroundBlur: number;
  alwaysOnTop: boolean;
  showLinkPreviews: boolean;
  showCreatedAt: boolean;
  showItemSources: boolean;
  showScrollShortcuts?: boolean;
  doubleClickAction: DoubleClickAction;
  capturePlacement: CapturePlacement;
  captureHotkey: string;
  showWindowHotkey: string;
  windowBounds?: WindowBounds;
}

export interface CarbonDocument {
  version: 2;
  activeSectionId: string;
  doneViewBySection: Record<string, DoneViewMode>;
  sections: CarbonSection[];
  settings: CarbonSettings;
}

export const ALL_SECTIONS = "all";

function normalizeTimestamp(value: unknown, fallback: string) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? value
    : fallback;
}

function normalizeHttpUrl(value: unknown) {
  return typeof value === "string" && /^https?:\/\//i.test(value)
    ? value
    : undefined;
}

export function createDefaultDocument(): CarbonDocument {
  const inboxId = createId("section");
  return {
    version: 2,
    activeSectionId: ALL_SECTIONS,
    doneViewBySection: {},
    sections: [
      { id: inboxId, name: "Inbox", sortMode: "manual", items: [] },
    ],
    settings: {
      theme: "light",
      backgroundImage: "none",
      customBackgrounds: [],
      backgroundPositions: {},
      backgroundBlur: 32,
      alwaysOnTop: true,
      showLinkPreviews: true,
      showCreatedAt: true,
      showItemSources: true,
      showScrollShortcuts: true,
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
                    completedAt: item.completed
                      ? normalizeTimestamp(item.completedAt, item.updatedAt)
                      : undefined,
                    createdAt,
                    updatedAt: normalizeTimestamp(item.updatedAt, createdAt),
                    attachments: Array.isArray(item.attachments)
                      ? item.attachments
                          .filter(
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
                          .map((attachment) => ({
                            ...attachment,
                            sourceUrl: normalizeHttpUrl(attachment.sourceUrl),
                            pageUrl: normalizeHttpUrl(attachment.pageUrl),
                          }))
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

  const customBackgrounds = Array.isArray(input.settings?.customBackgrounds)
    ? input.settings.customBackgrounds.filter(
        (background): background is CustomAppBackground =>
          Boolean(
            background &&
              typeof background.id === "string" &&
              background.id.startsWith("background-") &&
              typeof background.label === "string" &&
              background.label.trim() &&
              typeof background.path === "string" &&
              /^assets\/[^/]+$/.test(background.path) &&
              typeof background.mimeType === "string" &&
              /^image\/(png|jpeg|webp|gif|bmp)$/.test(background.mimeType),
          ),
      )
    : [];
  const requestedBackground = input.settings?.backgroundImage;
  const backgroundImage =
    typeof requestedBackground === "string" &&
    (requestedBackground === "scenic-flowers" ||
      customBackgrounds.some(({ id }) => id === requestedBackground))
      ? requestedBackground
      : "none";
  const backgroundPositions =
    input.settings?.backgroundPositions &&
    typeof input.settings.backgroundPositions === "object" &&
    !Array.isArray(input.settings.backgroundPositions)
      ? Object.fromEntries(
          Object.entries(input.settings.backgroundPositions).flatMap(
            ([id, position]) => {
              if (
                !position ||
                typeof position !== "object" ||
                typeof position.x !== "number" ||
                !Number.isFinite(position.x) ||
                typeof position.y !== "number" ||
                !Number.isFinite(position.y) ||
                typeof position.zoom !== "number" ||
                !Number.isFinite(position.zoom)
              ) {
                return [];
              }
              return [
                [
                  id,
                  {
                    x: Math.min(100, Math.max(0, position.x)),
                    y: Math.min(100, Math.max(0, position.y)),
                    zoom: Math.min(6, Math.max(1, position.zoom)),
                  },
                ],
              ];
            },
          ),
        )
      : {};

  return {
    version: 2,
    activeSectionId,
    doneViewBySection:
      input.doneViewBySection &&
      typeof input.doneViewBySection === "object" &&
      !Array.isArray(input.doneViewBySection)
        ? Object.fromEntries(
            Object.entries(input.doneViewBySection).filter(
              ([key, mode]) =>
                (key === ALL_SECTIONS ||
                  sections.some((section) => section.id === key)) &&
                (mode === "active" || mode === "all" || mode === "done"),
            ),
          )
        : {},
    sections,
    settings: {
      ...fallback.settings,
      ...(input.settings ?? {}),
      theme: input.settings?.theme === "dark" ? "dark" : "light",
      backgroundImage,
      customBackgrounds,
      backgroundPositions,
      backgroundBlur:
        typeof input.settings?.backgroundBlur === "number" &&
        Number.isFinite(input.settings.backgroundBlur)
          ? Math.min(100, Math.max(0, input.settings.backgroundBlur))
          : fallback.settings.backgroundBlur,
      showLinkPreviews: input.settings?.showLinkPreviews !== false,
      showCreatedAt: input.settings?.showCreatedAt !== false,
      showItemSources: input.settings?.showItemSources !== false,
      showScrollShortcuts: input.settings?.showScrollShortcuts !== false,
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
