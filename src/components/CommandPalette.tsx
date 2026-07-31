import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Fzf } from "fzf";
import {
  Check,
  FileText,
  Folder,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ALL_SECTIONS, type CarbonSection } from "../lib/model";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: CarbonSection[];
  activeSectionId: string;
  onSelectSection: (id: string) => void;
  onCreateSection: (name: string) => void;
  onOpenSettings: () => void;
  onSetTheme: (theme: "light" | "dark") => void;
}

type Command = {
  id: string;
  label: string;
  detail?: string;
  group: "Sections" | "Actions";
  icon: typeof Folder;
  run: () => void;
  active?: boolean;
};

export function CommandPalette({
  open,
  onOpenChange,
  sections,
  activeSectionId,
  onSelectSection,
  onCreateSection,
  onOpenSettings,
  onSetTheme,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const commands = useMemo<Command[]>(
    () => [
      {
        id: "section-all",
        label: "All notes",
        detail: "Show every section",
        group: "Sections",
        icon: FileText,
        active: activeSectionId === ALL_SECTIONS,
        run: () => onSelectSection(ALL_SECTIONS),
      },
      ...sections.map((section) => ({
        id: `section-${section.id}`,
        label: section.name,
        detail: `${section.items.length} ${
          section.items.length === 1 ? "item" : "items"
        }`,
        group: "Sections" as const,
        icon: Folder,
        active: activeSectionId === section.id,
        run: () => onSelectSection(section.id),
      })),
      {
        id: "settings",
        label: "Open settings",
        detail: "Shortcuts, appearance, and storage",
        group: "Actions",
        icon: Settings,
        run: onOpenSettings,
      },
      {
        id: "theme-light",
        label: "Use light theme",
        group: "Actions",
        icon: Sun,
        run: () => onSetTheme("light"),
      },
      {
        id: "theme-dark",
        label: "Use dark theme",
        group: "Actions",
        icon: Moon,
        run: () => onSetTheme("dark"),
      },
    ],
    [
      activeSectionId,
      onOpenSettings,
      onSelectSection,
      onSetTheme,
      sections,
    ],
  );

  const results = useMemo(() => {
    if (!query.trim()) return commands;
    const fzf = new Fzf(commands, {
      selector: (command) => `${command.label} ${command.detail ?? ""}`,
    });
    return fzf.find(query).map((result) => result.item);
  }, [commands, query]);

  useEffect(() => setActiveIndex(0), [query, open]);

  function run(command: Command) {
    command.run();
    setQuery("");
    onOpenChange(false);
  }

  function createSection() {
    const name = query.trim().replace(/^#\s*/, "");
    if (!name) return;
    onCreateSection(name);
    setQuery("");
    onOpenChange(false);
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="command-overlay" />
        <DialogPrimitive.Content
          className="command-palette"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            Carbon commands
          </DialogPrimitive.Title>
          <div className="command-search">
            <Search size={17} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Switch section or run a command…"
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((index) =>
                    results.length ? (index + 1) % results.length : 0,
                  );
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((index) =>
                    results.length
                      ? (index - 1 + results.length) % results.length
                      : 0,
                  );
                  return;
                }
                if (event.key === "Enter") {
                  if (query.trim().startsWith("#")) createSection();
                  else if (results[activeIndex]) run(results[activeIndex]);
                  else createSection();
                }
              }}
            />
            <kbd>Esc</kbd>
          </div>
          <div className="command-results">
            {(["Sections", "Actions"] as const).map((group) => {
              const grouped = results.filter((command) => command.group === group);
              if (!grouped.length) return null;
              return (
                <div className="command-group" key={group}>
                  <p>{group}</p>
                  {grouped.map((command) => {
                    const Icon = command.icon;
                    const resultIndex = results.findIndex(
                      (result) => result.id === command.id,
                    );
                    return (
                      <button
                        type="button"
                        className={
                          resultIndex === activeIndex
                            ? "command-item active"
                            : "command-item"
                        }
                        key={command.id}
                        onClick={() => run(command)}
                        onMouseEnter={() => setActiveIndex(resultIndex)}
                      >
                        <Icon size={16} />
                        <span>
                          <strong>{command.label}</strong>
                          {command.detail && <small>{command.detail}</small>}
                        </span>
                        {command.active && <Check size={15} />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {results.length === 0 && (
              <button
                type="button"
                className="command-create"
                onClick={createSection}
              >
                <Plus size={16} />
                Create section “{query.replace(/^#\s*/, "")}”
              </button>
            )}
          </div>
          <div className="command-footer">
            <span>
              <kbd>↑</kbd><kbd>↓</kbd> navigate
            </span>
            <span>
              <kbd>↵</kbd> select
            </span>
            <span>Type # Name to create a section</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
