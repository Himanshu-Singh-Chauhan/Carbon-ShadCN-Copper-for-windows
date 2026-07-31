import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  register,
  unregister,
} from "@tauri-apps/plugin-global-shortcut";
import { Fzf } from "fzf";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clipboard,
  Command,
  Copy,
  Download,
  FileText,
  FolderOpen,
  Grip,
  Inbox,
  Menu,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { CarbonItemRow } from "./components/CarbonItemRow";
import { CommandPalette } from "./components/CommandPalette";
import { SettingsDialog } from "./components/SettingsDialog";
import { Button } from "./components/ui/button";
import { Dialog, DialogContent } from "./components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import {
  ALL_SECTIONS,
  type CarbonItem,
  type CarbonSection,
} from "./lib/model";
import {
  captureSelectedText,
  chooseDataPath,
  getDataPath,
  isTauri,
  loadDocument,
  quitApp,
  revealDataFile,
  saveDocument,
  showCaptureNotification,
} from "./lib/native";
import { getCarbonDocument, useCarbonStore } from "./lib/store";
import { cn, formatShortcut, isEditableTarget } from "./lib/utils";

type Toast = { id: number; message: string; kind?: "default" | "error" };
type ContextMenuState = {
  x: number;
  y: number;
  itemId: string;
  itemIds: string[];
} | null;

function App() {
  const {
    activeSectionId,
    sections,
    settings,
    hydrated,
    selectedIds,
    hydrate,
    addEntry,
    createSection,
    setActiveSection,
    toggleItem,
    updateItem,
    deleteItems,
    moveItems,
    reorderItem,
    setSelected,
    toggleSelected,
    clearSelected,
    updateSettings,
  } = useCarbonStore();

  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dataPath, setDataPath] = useState("Loading local data…");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(
    null,
  );
  const [captureReady, setCaptureReady] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureInFlight = useRef(false);
  const toastId = useRef(0);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const notify = useCallback(
    (message: string, kind: Toast["kind"] = "default") => {
      const id = ++toastId.current;
      setToasts((current) => [...current.slice(-2), { id, message, kind }]);
      window.setTimeout(
        () => setToasts((current) => current.filter((toast) => toast.id !== id)),
        2600,
      );
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadDocument(), getDataPath()])
      .then(([document, path]) => {
        if (cancelled) return;
        hydrate(document);
        setDataPath(path);
        void saveDocument(document);
      })
      .catch((error) => {
        hydrate(useCarbonStore.getState());
        notify(`Could not load Carbon data: ${String(error)}`, "error");
      });
    return () => {
      cancelled = true;
    };
  }, [hydrate, notify]);

  useEffect(() => {
    if (!hydrated) return;
    const unsubscribe = useCarbonStore.subscribe((state, previous) => {
      if (
        state.sections === previous.sections &&
        state.activeSectionId === previous.activeSectionId &&
        state.settings === previous.settings
      ) {
        return;
      }
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveDocument(getCarbonDocument()).catch((error) =>
          notify(`Could not save changes: ${String(error)}`, "error"),
        );
      }, 180);
    });
    return () => {
      unsubscribe();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [hydrated, notify]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark =
        settings.theme === "dark" ||
        (settings.theme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.dataset.theme = dark ? "dark" : "light";
      root.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings.theme]);

  useEffect(() => {
    if (!hydrated || !isTauri()) return;
    const appWindow = getCurrentWindow();
    void appWindow.setAlwaysOnTop(settings.alwaysOnTop).catch(() => undefined);
  }, [hydrated, settings.alwaysOnTop]);

  useEffect(() => {
    if (!isTauri()) return;
    let cleanup: (() => void) | undefined;
    void listen<boolean>("always-on-top-changed", ({ payload }) => {
      updateSettings({ alwaysOnTop: payload });
    }).then((unlisten) => {
      cleanup = unlisten;
    });
    return () => cleanup?.();
  }, [updateSettings]);

  useEffect(() => {
    if (!hydrated || !isTauri()) return;
    let disposed = false;
    const cleanups: (() => void)[] = [];
    const appWindow = getCurrentWindow();

    async function setupWindow() {
      if (settings.windowBounds) {
        const { x, y, width, height } = settings.windowBounds;
        await appWindow.setPosition(new PhysicalPosition(x, y));
        await appWindow.setSize(new PhysicalSize(width, height));
      }
      cleanups.push(
        await appWindow.onCloseRequested((event) => {
          event.preventDefault();
          void appWindow.hide();
        }),
      );
      cleanups.push(
        await appWindow.onMoved(({ payload }) => {
          const current = useCarbonStore.getState().settings.windowBounds;
          updateSettings({
            windowBounds: {
              x: payload.x,
              y: payload.y,
              width: current?.width ?? 390,
              height: current?.height ?? 720,
            },
          });
        }),
      );
      cleanups.push(
        await appWindow.onResized(({ payload }) => {
          const current = useCarbonStore.getState().settings.windowBounds;
          updateSettings({
            windowBounds: {
              x: current?.x ?? 80,
              y: current?.y ?? 80,
              width: payload.width,
              height: payload.height,
            },
          });
        }),
      );
    }
    void setupWindow().catch((error) =>
      notify(`Window preferences were not restored: ${String(error)}`, "error"),
    );
    return () => {
      disposed = true;
      if (disposed) cleanups.forEach((cleanup) => cleanup());
    };
    // Bounds are intentionally restored only once after hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !isTauri()) return;
    let cancelled = false;
    const hotkey = settings.captureHotkey;
    setCaptureReady(true);

    async function setupHotkey() {
      await unregister(hotkey).catch(() => undefined);
      await register(hotkey, async (event) => {
        if (
          event.state !== "Pressed" ||
          cancelled ||
          captureInFlight.current
        ) {
          return;
        }
        captureInFlight.current = true;
        try {
          const text = (await captureSelectedText()).trim();
          if (!text) {
            await getCurrentWindow().show();
            await getCurrentWindow().setFocus();
            notify("Nothing was selected. Type a note instead.");
            inputRef.current?.focus();
            return;
          }
          useCarbonStore.getState().addItem(text);
          await showCaptureNotification("Captured to Carbon");
        } catch {
          await getCurrentWindow().show();
          await getCurrentWindow().setFocus();
          notify(
            "Carbon couldn’t read this app’s selection. Clipboard untouched.",
            "error",
          );
        } finally {
          captureInFlight.current = false;
        }
      });
    }

    void setupHotkey().catch((error) => {
      setCaptureReady(false);
      notify(`Shortcut unavailable: ${String(error)}`, "error");
    });
    return () => {
      cancelled = true;
      void unregister(hotkey).catch(() => undefined);
    };
  }, [hydrated, notify, settings.captureHotkey]);

  const sourceSections = useMemo(
    () =>
      activeSectionId === ALL_SECTIONS
        ? sections
        : sections.filter((section) => section.id === activeSectionId),
    [activeSectionId, sections],
  );

  const visibleSections = useMemo(() => {
    if (!query.trim()) return sourceSections;
    const items = sourceSections.flatMap((section) =>
      section.items.map((item) => ({ item, sectionId: section.id })),
    );
    const fzf = new Fzf(items, {
      selector: (entry) => entry.item.text,
      fuzzy: "v2",
    });
    const matchingIds = new Set(
      fzf.find(query).map((result) => result.item.item.id),
    );
    return sourceSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => matchingIds.has(item.id)),
      }))
      .filter((section) => section.items.length > 0);
  }, [query, sourceSections]);

  const allVisibleItems = useMemo(
    () => visibleSections.flatMap((section) => section.items),
    [visibleSections],
  );
  const selectedItems = useMemo(() => {
    const selection = new Set(selectedIds);
    return sections.flatMap((section) =>
      section.items.filter((item) => selection.has(item.id)),
    );
  }, [sections, selectedIds]);

  function itemsForIds(ids: string[]) {
    const selection = new Set(ids);
    return useCarbonStore
      .getState()
      .sections.flatMap((section) =>
        section.items.filter((item) => selection.has(item.id)),
      );
  }

  async function copyItems(items: CarbonItem[], asList = false) {
    if (!items.length) return;
    const content = asList
      ? items.map((item) => `- ${item.text.replace(/\n/g, "\n  ")}`).join("\n")
      : items.map((item) => item.text).join("\n\n");
    try {
      if (isTauri()) await writeText(content);
      else await navigator.clipboard.writeText(content);
      notify(`Copied ${items.length} ${items.length === 1 ? "item" : "items"}`);
    } catch {
      notify("Clipboard access was unavailable.", "error");
    }
  }

  function copySelectedItems(asList = false) {
    return copyItems(itemsForIds(useCarbonStore.getState().selectedIds), asList);
  }

  async function copyMarkdown() {
    const content = sourceSections
      .map(
        (section) =>
          `# ${section.name}\n\n${section.items
            .map((item) => `- [${item.completed ? "x" : " "}] ${item.text}`)
            .join("\n")}`,
      )
      .join("\n\n");
    if (!content.trim()) return notify("There is nothing to export.");
    if (isTauri()) await writeText(content);
    else await navigator.clipboard.writeText(content);
    notify("Markdown copied to clipboard");
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (modifier && event.key === ",") {
        event.preventDefault();
        setSettingsOpen(true);
        return;
      }
      if (modifier && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (modifier && event.key.toLowerCase() === "c" && selectedIds.length) {
        event.preventDefault();
        void copySelectedItems();
        return;
      }
      if (isEditableTarget(event.target)) return;
      if (modifier && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setSelected(allVisibleItems.map((item) => item.id));
      } else if (event.key === "Delete" && selectedIds.length) {
        event.preventDefault();
        deleteItems();
      } else if (event.key === " " && selectedIds.length) {
        event.preventDefault();
        selectedIds.forEach(toggleItem);
      } else if (event.key === "Escape") {
        clearSelected();
        setContextMenu(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    allVisibleItems,
    clearSelected,
    deleteItems,
    selectedIds,
    selectedItems,
    setSelected,
    toggleItem,
  ]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
    };
  }, [contextMenu]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "0px";
    input.style.height = `${Math.min(input.scrollHeight, 124)}px`;
  }, [draft]);

  function submitDraft() {
    const text = draft.trim();
    if (!text) return;
    addEntry(text);
    setDraft("");
    if (/^#\s+/.test(text)) {
      notify("Section created");
    } else {
      void showCaptureNotification("Added to Carbon");
    }
  }

  function sectionForItem(itemId: string) {
    return sections.find((section) =>
      section.items.some((item) => item.id === itemId),
    );
  }

  function openContextMenu(event: MouseEvent, itemId: string) {
    event.preventDefault();
    if (!selectedIds.includes(itemId)) setSelected([itemId]);
    setContextMenu({
      x: Math.min(event.clientX, window.innerWidth - 220),
      y: Math.min(event.clientY, window.innerHeight - 320),
      itemId,
      itemIds: selectedIds.includes(itemId) ? [...selectedIds] : [itemId],
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;
    const section = sectionForItem(activeId);
    if (section?.items.some((item) => item.id === overId)) {
      reorderItem(section.id, activeId, overId);
    }
  }

  async function changeDataPath() {
    const next = await chooseDataPath(getCarbonDocument());
    if (next) {
      setDataPath(next);
      notify("Carbon data location changed");
    }
  }

  async function revealLocalData() {
    try {
      await revealDataFile();
    } catch (error) {
      notify(String(error), "error");
    }
  }

  const activeName =
    activeSectionId === ALL_SECTIONS
      ? "All notes"
      : sections.find((section) => section.id === activeSectionId)?.name ??
        "Inbox";
  const captureSectionName =
    activeSectionId === ALL_SECTIONS
      ? sections[0]?.name ?? "Inbox"
      : activeName;
  const itemCount = sourceSections.reduce(
    (count, section) => count + section.items.length,
    0,
  );
  const contextItem = contextMenu
    ? sections
        .flatMap((section) => section.items)
        .find((item) => item.id === contextMenu.itemId)
    : undefined;
  const contextSelectedItems = contextMenu
    ? itemsForIds(contextMenu.itemIds)
    : [];

  if (!hydrated) {
    return (
      <main className="carbon-shell carbon-loading">
        <div className="loading-mark">
          <Sparkles size={19} />
        </div>
        <p>Opening Carbon…</p>
      </main>
    );
  }

  return (
    <main className="carbon-shell">
      <div className="drag-strip" data-tauri-drag-region />
      <header className="topbar">
        <label className="search-field">
          <Search size={17} />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search notes"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear">
              <X size={14} />
            </button>
          )}
          {!query && <kbd>Ctrl F</kbd>}
        </label>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="more-button" type="button" aria-label="Carbon menu">
              <MoreHorizontal size={18} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>View</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setCommandOpen(true)}>
              <Command size={15} />
              Command menu
              <DropdownMenuShortcut>Ctrl K</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Inbox size={15} />
                Switch section
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={activeSectionId}
                  onValueChange={setActiveSection}
                >
                  <DropdownMenuRadioItem value={ALL_SECTIONS}>
                    All notes
                  </DropdownMenuRadioItem>
                  {sections.map((section) => (
                    <DropdownMenuRadioItem value={section.id} key={section.id}>
                      {section.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuCheckboxItem
              checked={settings.alwaysOnTop}
              onCheckedChange={(alwaysOnTop) =>
                updateSettings({ alwaysOnTop: Boolean(alwaysOnTop) })
              }
            >
              {settings.alwaysOnTop ? <Pin size={15} /> : <PinOff size={15} />}
              Always on top
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void copyMarkdown()}>
              <Download size={15} />
              Copy view as Markdown
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void revealLocalData()}>
              <FolderOpen size={15} />
              Reveal local data
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => notify("You’re on the latest development build.")}
            >
              <CheckCircle2 size={15} />
              Check for updates
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
              <Settings size={15} />
              Settings
              <DropdownMenuShortcut>Ctrl ,</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="danger-item" onSelect={() => void quitApp()}>
              <X size={15} />
              Quit Carbon
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="view-heading">
        <button type="button" onClick={() => setCommandOpen(true)}>
          <span>{activeName}</span>
          <ChevronDown size={13} />
        </button>
        <span>
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
      </div>

      <section className="notes-scroll" aria-label="Carbon notes">
        {itemCount === 0 && !query ? (
          <EmptyState
            captureHotkey={formatShortcut(settings.captureHotkey)}
            captureReady={captureReady}
            onFocusInput={() => inputRef.current?.focus()}
            onOpenCommands={() => setCommandOpen(true)}
          />
        ) : visibleSections.length === 0 ? (
          <div className="search-empty">
            <Search size={22} />
            <strong>No matching notes</strong>
            <p>Try a shorter phrase or search another section.</p>
            <Button variant="outline" size="sm" onClick={() => setQuery("")}>
              Clear search
            </Button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="sections-stack">
              {visibleSections.map((section) => (
                <SectionGroup
                  key={section.id}
                  section={section}
                  query={query}
                  selectedIds={selectedIds}
                  dragDisabled={Boolean(query)}
                  onToggle={toggleItem}
                  onSelect={(itemId, event) => {
                    if (event.ctrlKey || event.metaKey) {
                      toggleSelected(itemId);
                    } else {
                      setSelected(
                        selectedIds.length === 1 && selectedIds[0] === itemId
                          ? []
                          : [itemId],
                      );
                    }
                  }}
                  onContextMenu={openContextMenu}
                  onEdit={(item) => setEditing({ id: item.id, text: item.text })}
                />
              ))}
            </div>
          </DndContext>
        )}
      </section>

      {selectedItems.length > 0 && (
        <div className="selection-bar">
          <button type="button" onClick={clearSelected} aria-label="Clear selection">
            <X size={14} />
          </button>
          <strong>{selectedItems.length} selected</strong>
          <span />
          <button type="button" onClick={() => void copySelectedItems()}>
            <Copy size={14} />
            Copy
          </button>
          <button
            type="button"
            className="selection-delete"
            onClick={() => deleteItems()}
            aria-label="Delete selected"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      <footer className="composer-wrap">
        <div className={cn("composer", draft && "composer--active")}>
          <div className="composer-main">
            <Circle size={20} />
            <textarea
              ref={inputRef}
              value={draft}
              rows={1}
              placeholder="Add a note or a prompt…"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitDraft();
                }
              }}
            />
            {draft.trim() && (
              <button
                type="button"
                className="add-button"
                onClick={submitDraft}
                aria-label="Add note"
              >
                <Plus size={17} />
              </button>
            )}
          </div>
          <div className="composer-meta">
            <button type="button" onClick={() => setCommandOpen(true)}>
              <Inbox size={12} />
              {captureSectionName}
            </button>
            <span>
              <kbd>Enter</kbd> add · <kbd>Shift Enter</kbd> new line
            </span>
          </div>
        </div>
      </footer>

      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        sections={sections}
        activeSectionId={activeSectionId}
        onSelectSection={setActiveSection}
        onCreateSection={createSection}
        onOpenSettings={() => setSettingsOpen(true)}
        onSetTheme={(theme) => updateSettings({ theme })}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        dataPath={dataPath}
        onUpdate={updateSettings}
        onChooseDataPath={changeDataPath}
        onRevealData={() => void revealLocalData()}
      />

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && (
          <DialogContent title="Edit note" description="Changes are saved locally.">
            <textarea
              className="edit-textarea"
              autoFocus
              value={editing.text}
              onChange={(event) =>
                setEditing({ ...editing, text: event.target.value })
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  updateItem(editing.id, editing.text);
                  setEditing(null);
                }
              }}
            />
            <div className="dialog-actions">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editing.text.trim()) updateItem(editing.id, editing.text);
                  setEditing(null);
                }}
              >
                Save note
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {contextMenu && contextItem && (
        <ItemContextMenu
          state={contextMenu}
          item={contextItem}
          selectedItems={contextSelectedItems}
          sections={sections}
          onCopy={(asList) => void copyItems(contextSelectedItems, asList)}
          onToggle={() =>
            contextSelectedItems.forEach((item) => toggleItem(item.id))
          }
          onEdit={() => setEditing({ id: contextItem.id, text: contextItem.text })}
          onMove={(sectionId) =>
            moveItems(
              contextSelectedItems.map((item) => item.id),
              sectionId,
            )
          }
          onDelete={() =>
            deleteItems(contextSelectedItems.map((item) => item.id))
          }
        />
      )}

      <div className="toast-region" aria-live="polite">
        {toasts.map((toast) => (
          <div
            className={cn("toast", toast.kind === "error" && "toast--error")}
            key={toast.id}
          >
            {toast.kind === "error" ? <X size={14} /> : <Check size={14} />}
            {toast.message}
          </div>
        ))}
      </div>
    </main>
  );
}

function SectionGroup({
  section,
  query,
  selectedIds,
  dragDisabled,
  onToggle,
  onSelect,
  onContextMenu,
  onEdit,
}: {
  section: CarbonSection;
  query: string;
  selectedIds: string[];
  dragDisabled: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string, event: MouseEvent) => void;
  onContextMenu: (event: MouseEvent, id: string) => void;
  onEdit: (item: CarbonItem) => void;
}) {
  return (
    <section className="note-section">
      <div className="section-label">
        <span>{section.name}</span>
        <div />
        <small>{section.items.length}</small>
      </div>
      <SortableContext
        items={section.items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="note-list">
          {section.items.map((item) => (
            <CarbonItemRow
              key={item.id}
              item={item}
              searchQuery={query}
              selected={selectedIds.includes(item.id)}
              dragDisabled={dragDisabled}
              onToggle={() => onToggle(item.id)}
              onSelect={(event) => onSelect(item.id, event)}
              onContextMenu={(event) => onContextMenu(event, item.id)}
              onEdit={() => onEdit(item)}
            />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

function EmptyState({
  captureHotkey,
  captureReady,
  onFocusInput,
  onOpenCommands,
}: {
  captureHotkey: string;
  captureReady: boolean;
  onFocusInput: () => void;
  onOpenCommands: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-art">
        <div className="paper paper-one" />
        <div className="paper paper-two" />
        <div className="paper paper-three">
          <Grip size={18} />
        </div>
      </div>
      <div>
        <h2>Nothing captured yet</h2>
        <p>An answer, a link, a half-formed prompt. It all waits here.</p>
      </div>
      <div className="shortcut-list">
        <button type="button" onClick={onFocusInput}>
          <span>Capture selected text</span>
          <kbd>{captureHotkey}</kbd>
        </button>
        <button type="button" onClick={onFocusInput}>
          <span>Add a note manually</span>
          <kbd>Enter</kbd>
        </button>
        <button type="button" onClick={onOpenCommands}>
          <span>Switch sections</span>
          <kbd>Ctrl K</kbd>
        </button>
      </div>
      {!captureReady && (
        <p className="capture-warning">
          The global shortcut is unavailable. Change it in Settings.
        </p>
      )}
    </div>
  );
}

function ItemContextMenu({
  state,
  item,
  selectedItems,
  sections,
  onCopy,
  onToggle,
  onEdit,
  onMove,
  onDelete,
}: {
  state: NonNullable<ContextMenuState>;
  item: CarbonItem;
  selectedItems: CarbonItem[];
  sections: CarbonSection[];
  onCopy: (asList: boolean) => void;
  onToggle: () => void;
  onEdit: () => void;
  onMove: (sectionId: string) => void;
  onDelete: () => void;
}) {
  const [showMove, setShowMove] = useState(false);
  return (
    <div
      className="context-menu"
      style={{ left: state.x, top: state.y }}
      onPointerDown={(event) => event.stopPropagation()}
      role="menu"
    >
      {selectedItems.length > 1 && (
        <div className="context-title">{selectedItems.length} selected notes</div>
      )}
      <button type="button" role="menuitem" onClick={() => onCopy(false)}>
        <Copy size={15} />
        Copy
        <kbd>Ctrl C</kbd>
      </button>
      <button type="button" role="menuitem" onClick={() => onCopy(true)}>
        <Clipboard size={15} />
        Copy as list
      </button>
      <div className="context-separator" />
      <button type="button" role="menuitem" onClick={onToggle}>
        <CheckCircle2 size={15} />
        {item.completed ? "Mark as not done" : "Mark as done"}
        <kbd>Space</kbd>
      </button>
      <button type="button" role="menuitem" onClick={onEdit}>
        <FileText size={15} />
        Edit
        <kbd>Enter</kbd>
      </button>
      <div className="context-move-wrap">
        <button
          type="button"
          role="menuitem"
          onMouseEnter={() => setShowMove(true)}
          onClick={() => setShowMove((value) => !value)}
        >
          <Menu size={15} />
          Move to
          <ChevronDown size={13} />
        </button>
        {showMove && (
          <div className="context-submenu">
            {sections.map((section) => (
              <button
                type="button"
                key={section.id}
                onClick={() => onMove(section.id)}
              >
                <Inbox size={14} />
                {section.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="context-separator" />
      <button
        type="button"
        role="menuitem"
        className="context-danger"
        onClick={onDelete}
      >
        <Trash2 size={15} />
        Delete
        <kbd>Del</kbd>
      </button>
    </div>
  );
}

export default App;
