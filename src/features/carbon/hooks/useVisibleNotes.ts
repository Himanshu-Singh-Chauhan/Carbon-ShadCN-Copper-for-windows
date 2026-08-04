import { useMemo, useState } from "react";
import { Fzf } from "fzf";
import type { SourceFilterOption } from "../../../components/SourceFilterMenu";
import {
  ALL_SECTIONS,
  type CarbonItem,
  type CarbonSection,
} from "../../../lib/model";

const UNATTRIBUTED_SOURCE_KEY = "source:unattributed";

function itemSourceKey(item: CarbonItem) {
  return item.source ? `source:app:${item.source.id}` : UNATTRIBUTED_SOURCE_KEY;
}

function createSourceFilterOptions(sections: CarbonSection[]) {
  const options = new Map<string, SourceFilterOption>();
  for (const item of sections.flatMap((section) => section.items)) {
    const key = itemSourceKey(item);
    const existing = options.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    options.set(key, {
      key,
      label: item.source?.appName ?? "Unattributed",
      description: item.source ? undefined : "No captured app",
      source: item.source,
      count: 1,
    });
  }
  return [...options.values()].sort((left, right) => {
    if (left.key === UNATTRIBUTED_SOURCE_KEY) return 1;
    if (right.key === UNATTRIBUTED_SOURCE_KEY) return -1;
    return left.label.localeCompare(right.label);
  });
}

function filterByQuery(sections: CarbonSection[], query: string) {
  if (!query.trim()) return sections;

  const items = sections.flatMap((section) =>
    section.items.map((item) => ({ item, sectionId: section.id })),
  );
  const matchingIds = new Set(
    new Fzf(items, {
      selector: (entry) => entry.item.text,
      fuzzy: "v2",
    })
      .find(query)
      .map((result) => result.item.item.id),
  );
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => matchingIds.has(item.id)),
    }))
    .filter((section) => section.items.length > 0);
}

function sortSections(sections: CarbonSection[]) {
  return sections.map((section) => {
    if (section.sortMode === "manual") return section;
    const direction = section.sortMode === "created-asc" ? 1 : -1;
    return {
      ...section,
      items: [...section.items].sort(
        (left, right) =>
          direction *
          (Date.parse(left.createdAt) - Date.parse(right.createdAt)),
      ),
    };
  });
}

export function useVisibleNotes({
  activeSectionId,
  query,
  sections,
}: {
  activeSectionId: string;
  query: string;
  sections: CarbonSection[];
}) {
  const [sourceFilters, setSourceFilters] = useState<
    Record<string, string[]>
  >({});
  const sourceSections = useMemo(
    () =>
      activeSectionId === ALL_SECTIONS
        ? sections
        : sections.filter((section) => section.id === activeSectionId),
    [activeSectionId, sections],
  );
  const selectedSourceKeys = sourceFilters[activeSectionId] ?? [];
  const sourceFilterOptions = useMemo(
    () => createSourceFilterOptions(sourceSections),
    [sourceSections],
  );
  const visibleSections = useMemo(() => {
    const selectedSources = new Set(selectedSourceKeys);
    const sourceFiltered =
      selectedSources.size === 0
        ? sourceSections
        : sourceSections
            .map((section) => ({
              ...section,
              items: section.items.filter((item) =>
                selectedSources.has(itemSourceKey(item)),
              ),
            }))
            .filter((section) => section.items.length > 0);
    return sortSections(filterByQuery(sourceFiltered, query));
  }, [query, selectedSourceKeys, sourceSections]);

  return {
    allVisibleItems: visibleSections.flatMap((section) => section.items),
    clearSourceFilter: () =>
      setSourceFilters((current) => ({
        ...current,
        [activeSectionId]: [],
      })),
    itemCount: sourceSections.reduce(
      (count, section) => count + section.items.length,
      0,
    ),
    selectedSourceKeys,
    sourceFilterOptions,
    sourceSections,
    toggleSourceFilter: (key: string) =>
      setSourceFilters((current) => {
        const selected = current[activeSectionId] ?? [];
        return {
          ...current,
          [activeSectionId]: selected.includes(key)
            ? selected.filter((selectedKey) => selectedKey !== key)
            : [...selected, key],
        };
      }),
    visibleSections,
  };
}
