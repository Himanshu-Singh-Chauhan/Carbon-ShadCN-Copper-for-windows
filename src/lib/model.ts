import { createId } from "./utils";

export type Theme = "light" | "dark";

export interface CarbonAttachment {
  id: string;
  path: string;
  mimeType: string;
  width: number;
  height: number;
}

export interface CarbonItem {
  id: string;
  text: string;
  attachments: CarbonAttachment[];
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CarbonSection {
  id: string;
  name: string;
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

export function createDefaultDocument(): CarbonDocument {
  const inboxId = createId("section");
  return {
    version: 2,
    activeSectionId: ALL_SECTIONS,
    sections: [{ id: inboxId, name: "Inbox", items: [] }],
    settings: {
      theme: "light",
      alwaysOnTop: true,
      captureHotkey: "CommandOrControl+Shift+C",
      showWindowHotkey: "CommandOrControl+Shift+Space",
    },
  };
}

export function normalizeDocument(value: unknown): CarbonDocument {
  const fallback = createDefaultDocument();
  if (!value || typeof value !== "object") return fallback;

  const input = value as Partial<CarbonDocument>;
  const sections = Array.isArray(input.sections)
    ? input.sections
        .filter(
          (section): section is CarbonSection =>
            Boolean(
              section &&
                typeof section.id === "string" &&
                typeof section.name === "string",
            ),
        )
        .map((section) => ({
          id: section.id,
          name: section.name,
          items: Array.isArray(section.items)
            ? section.items
                .filter(
                  (item) =>
                  item &&
                  typeof item.id === "string" &&
                  typeof item.text === "string",
                )
                .map((item) => ({
                  ...item,
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
                }))
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
