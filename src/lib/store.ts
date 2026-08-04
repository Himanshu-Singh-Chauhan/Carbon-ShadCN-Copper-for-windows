import { arrayMove } from "@dnd-kit/sortable";
import { create } from "zustand";
import {
  ALL_SECTIONS,
  type CarbonAttachment,
  type CarbonDocument,
  type CarbonItem,
  type CarbonItemSource,
  type CarbonSettings,
  type NoteSortMode,
  createDefaultDocument,
} from "./model";
import { createId } from "./utils";

interface CarbonState extends CarbonDocument {
  hydrated: boolean;
  selectedIds: string[];
  hydrate: (document: CarbonDocument) => void;
  addEntry: (
    text: string,
    attachments?: CarbonAttachment[],
  ) => AddedItem | undefined;
  addItem: (
    text: string,
    sectionId?: string,
    attachments?: CarbonAttachment[],
    source?: CarbonItemSource,
  ) => AddedItem | undefined;
  applyNativeItem: (item: CarbonItem, sectionId: string) => void;
  createSection: (name: string) => void;
  renameSection: (sectionId: string, name: string) => void;
  deleteSection: (sectionId: string) => void;
  setActiveSection: (sectionId: string) => void;
  toggleItem: (itemId: string) => void;
  updateItem: (
    itemId: string,
    text: string,
    attachments?: CarbonAttachment[],
  ) => void;
  deleteItems: (ids?: string[]) => void;
  moveItems: (itemIds: string[], sectionId: string) => void;
  reorderItem: (sectionId: string, activeId: string, overId: string) => void;
  setSectionSortMode: (sectionId: string, sortMode: NoteSortMode) => void;
  setSelected: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
  clearSelected: () => void;
  updateSettings: (settings: Partial<CarbonSettings>) => void;
}

export interface AddedItem {
  item: CarbonItem;
  sectionId: string;
}

const initial = createDefaultDocument();

function mapItems(
  sections: CarbonDocument["sections"],
  update: (item: CarbonItem) => CarbonItem,
) {
  return sections.map((section) => ({
    ...section,
    items: section.items.map(update),
  }));
}

function targetSectionId(state: CarbonState, requested?: string) {
  if (requested && requested !== ALL_SECTIONS) return requested;
  if (state.activeSectionId !== ALL_SECTIONS) return state.activeSectionId;
  return state.sections[0]?.id;
}

export const useCarbonStore = create<CarbonState>((set, get) => ({
  ...initial,
  hydrated: false,
  selectedIds: [],

  hydrate: (document) =>
    set({ ...document, hydrated: true, selectedIds: [] }),

  addEntry: (rawText, attachments = []) => {
    const text = rawText.trim();
    if (!text && attachments.length === 0) return;
    if (attachments.length === 0 && /^#\s+/.test(text)) {
      get().createSection(text.replace(/^#\s+/, ""));
      return;
    }
    return get().addItem(text, undefined, attachments);
  },

  addItem: (text, requestedSectionId, attachments = [], source) => {
    const sectionId = targetSectionId(get(), requestedSectionId);
    if (!sectionId) return undefined;
    const now = new Date().toISOString();
    const item: CarbonItem = {
      id: createId("item"),
      text: text.trim(),
      attachments,
      source,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      sections: state.sections.map((section) =>
        section.id === sectionId
          ? { ...section, items: [...section.items, item] }
          : section,
      ),
    }));
    return { item, sectionId };
  },

  applyNativeItem: (item, sectionId) =>
    set((state) => {
      if (
        state.sections.some((section) =>
          section.items.some((candidate) => candidate.id === item.id),
        )
      ) {
        return state;
      }
      return {
        sections: state.sections.map((section) =>
          section.id === sectionId
            ? { ...section, items: [...section.items, item] }
            : section,
        ),
      };
    }),

  createSection: (rawName) =>
    set((state) => {
      const name = rawName.trim().replace(/^#\s*/, "");
      if (!name) return state;
      const existing = state.sections.find(
        (section) => section.name.toLowerCase() === name.toLowerCase(),
      );
      if (existing) return { activeSectionId: existing.id };
      const section = {
        id: createId("section"),
        name,
        sortMode: "manual" as const,
        items: [],
      };
      return {
        sections: [...state.sections, section],
        activeSectionId: section.id,
        selectedIds: [],
      };
    }),

  renameSection: (sectionId, rawName) =>
    set((state) => ({
      sections: state.sections.map((section) =>
        section.id === sectionId
          ? { ...section, name: rawName.trim() || section.name }
          : section,
      ),
    })),

  deleteSection: (sectionId) =>
    set((state) => {
      if (state.sections.length <= 1) return state;
      const source = state.sections.find((section) => section.id === sectionId);
      const destination = state.sections.find(
        (section) => section.id !== sectionId,
      );
      if (!source || !destination) return state;
      return {
        sections: state.sections
          .filter((section) => section.id !== sectionId)
          .map((section) =>
            section.id === destination.id
              ? { ...section, items: [...section.items, ...source.items] }
              : section,
          ),
        activeSectionId:
          state.activeSectionId === sectionId
            ? destination.id
            : state.activeSectionId,
        selectedIds: [],
      };
    }),

  setActiveSection: (activeSectionId) =>
    set({ activeSectionId, selectedIds: [] }),

  toggleItem: (itemId) =>
    set((state) => ({
      sections: mapItems(state.sections, (item) =>
        item.id === itemId
          ? {
              ...item,
              completed: !item.completed,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    })),

  updateItem: (itemId, text, attachments) =>
    set((state) => ({
      sections: mapItems(state.sections, (item) =>
        item.id === itemId
          ? {
              ...item,
              text: text.trim(),
              attachments: attachments ?? item.attachments,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    })),

  deleteItems: (ids) =>
    set((state) => {
      const removing = new Set(ids ?? state.selectedIds);
      return {
        sections: state.sections.map((section) => ({
          ...section,
          items: section.items.filter((item) => !removing.has(item.id)),
        })),
        selectedIds: state.selectedIds.filter((id) => !removing.has(id)),
      };
    }),

  moveItems: (itemIds, destinationId) =>
    set((state) => {
      if (!state.sections.some((section) => section.id === destinationId)) {
        return state;
      }
      const movingIds = new Set(itemIds);
      const moving = state.sections.flatMap((section) =>
        section.items.filter((item) => movingIds.has(item.id)),
      );
      return {
        sections: state.sections.map((section) => ({
          ...section,
          items:
            section.id === destinationId
              ? [
                  ...section.items.filter((item) => !movingIds.has(item.id)),
                  ...moving,
                ]
              : section.items.filter((item) => !movingIds.has(item.id)),
        })),
        selectedIds: [],
      };
    }),

  reorderItem: (sectionId, activeId, overId) =>
    set((state) => ({
      sections: state.sections.map((section) => {
        if (section.id !== sectionId) return section;
        const oldIndex = section.items.findIndex((item) => item.id === activeId);
        const newIndex = section.items.findIndex((item) => item.id === overId);
        if (oldIndex < 0 || newIndex < 0) return section;
        return { ...section, items: arrayMove(section.items, oldIndex, newIndex) };
      }),
    })),

  setSectionSortMode: (sectionId, sortMode) =>
    set((state) => ({
      sections: state.sections.map((section) =>
        section.id === sectionId ? { ...section, sortMode } : section,
      ),
    })),

  setSelected: (selectedIds) => set({ selectedIds }),

  toggleSelected: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((selectedId) => selectedId !== id)
        : [...state.selectedIds, id],
    })),

  clearSelected: () => set({ selectedIds: [] }),

  updateSettings: (settings) =>
    set((state) => ({ settings: { ...state.settings, ...settings } })),
}));

export function getCarbonDocument(): CarbonDocument {
  const state = useCarbonStore.getState();
  return {
    version: 2,
    activeSectionId: state.activeSectionId,
    sections: state.sections,
    settings: state.settings,
  };
}
