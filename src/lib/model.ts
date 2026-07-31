import { createId } from "./utils";

export type Theme = "system" | "light" | "dark";

export interface CarbonItem {
  id: string;
  text: string;
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
  windowBounds?: WindowBounds;
}

export interface CarbonDocument {
  version: 1;
  activeSectionId: string;
  sections: CarbonSection[];
  settings: CarbonSettings;
}

export const ALL_SECTIONS = "all";

export function createDefaultDocument(): CarbonDocument {
  const inboxId = createId("section");
  return {
    version: 1,
    activeSectionId: ALL_SECTIONS,
    sections: [{ id: inboxId, name: "Inbox", items: [] }],
    settings: {
      theme: "system",
      alwaysOnTop: true,
      captureHotkey: "CommandOrControl+Shift+C",
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
          ...section,
          items: Array.isArray(section.items)
            ? section.items.filter(
                (item) =>
                  item &&
                  typeof item.id === "string" &&
                  typeof item.text === "string",
              )
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
    version: 1,
    activeSectionId,
    sections,
    settings: {
      ...fallback.settings,
      ...(input.settings ?? {}),
    },
  };
}
