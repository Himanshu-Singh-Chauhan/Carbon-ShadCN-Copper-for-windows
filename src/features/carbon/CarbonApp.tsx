import { type DragEndEvent } from "@dnd-kit/core";
import { SparklesIcon } from "@hugeicons/core-free-icons";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Fzf } from "fzf";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { CommandPalette } from "../../components/CommandPalette";
import { SettingsDialog } from "../../components/SettingsDialog";
import { Icon } from "../../components/ui/icon";
import {
  ALL_SECTIONS,
  type CarbonAttachment,
  type CarbonItem,
} from "../../lib/model";
import {
  chooseDataPath,
  copyItemsToClipboardHistory,
  isTauri,
  quitApp,
  revealDataFile,
  showImageViewer,
} from "../../lib/native";
import {
  type AddedItem,
  getCarbonDocument,
  useCarbonStore,
} from "../../lib/store";
import { formatShortcut, isEditableTarget } from "../../lib/utils";
import { AppHeader } from "./components/AppHeader";
import { ItemContextMenu } from "./components/ItemContextMenu";
import { NoteComposer } from "./components/NoteComposer";
import { NotesView } from "./components/NotesView";
import { PasteContextMenu } from "./components/PasteContextMenu";
import { SelectionToolbar } from "./components/SelectionToolbar";
import { ToastRegion } from "./components/ToastRegion";
import { useCaptureShortcut } from "./hooks/useCaptureShortcut";
import { useCarbonPersistence } from "./hooks/useCarbonPersistence";
import { useDraftComposer } from "./hooks/useDraftComposer";
import { useDoublePressShortcuts } from "./hooks/useDoublePressShortcuts";
import { useFlexiblePaste } from "./hooks/useFlexiblePaste";
import { useShowWindowShortcut } from "./hooks/useShowWindowShortcut";
import { useTheme } from "./hooks/useTheme";
import { useWindowIntegration } from "./hooks/useWindowIntegration";
import type { ContextMenuState, ToastMessage } from "./types";

function fileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function CarbonApp() {
  const {
    activeSectionId,
    sections,
    settings,
    hydrated,
    selectedIds,
    hydrate,
    addEntry,
    addItem,
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
  const [commandOpen, setCommandOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dataPath, setDataPath] = useState("Loading local data…");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [pasteMenu, setPasteMenu] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [captureReady, setCaptureReady] = useState(true);
  const [copyingItems, setCopyingItems] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const toastId = useRef(0);
  const copyInFlight = useRef(false);

  const notify = useCallback(
    (message: string, kind: ToastMessage["kind"] = "default") => {
      const id = ++toastId.current;
      setToasts((current) => [...current.slice(-2), { id, message, kind }]);
      window.setTimeout(
        () => setToasts((current) => current.filter((toast) => toast.id !== id)),
        2600,
      );
    },
    [],
  );

  const revealAddedItem = useCallback(
    (added: AddedItem) => {
      setQuery("");
      setFocusedItemId(added.item.id);
      clearSelected();

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const card = Array.from(
            document.querySelectorAll<HTMLElement>("[data-item-id]"),
          ).find((element) => element.dataset.itemId === added.item.id);
          card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      });
    },
    [clearSelected],
  );

  const revealPastedItem = useCallback(
    (added: AddedItem) => {
      setPasteMenu(null);
      revealAddedItem(added);
    },
    [revealAddedItem],
  );

  const {
    addPastedImages,
    cancelEditing,
    draft,
    draftImages,
    editingItemId,
    existingAttachments,
    inputRef,
    removeDraftImage,
    removeExistingAttachment,
    savingDraft,
    setDraft,
    startEditing,
    submitDraft,
  } = useDraftComposer({
    addEntry,
    deleteItems,
    notify,
    onItemAdded: revealAddedItem,
    updateItem,
  });

  const pasteFromClipboard = useFlexiblePaste({
    addItem,
    enabled: hydrated && !commandOpen && !settingsOpen,
    notify,
    onItemAdded: revealPastedItem,
  });

  useCarbonPersistence({
    hydrated,
    hydrate,
    notify,
    onDataPath: setDataPath,
  });
  useTheme(settings.theme);
  useWindowIntegration({ hydrated, settings, updateSettings, notify });
  useCaptureShortcut({
    enabled: !settingsOpen,
    hydrated,
    hotkey: settings.captureHotkey,
    inputRef,
    notify,
    onReadyChange: setCaptureReady,
  });
  useShowWindowShortcut({
    enabled: !settingsOpen,
    hotkey: settings.showWindowHotkey,
    hydrated,
    notify,
  });
  useDoublePressShortcuts({
    captureHotkey: settings.captureHotkey,
    enabled: !settingsOpen,
    hydrated,
    notify,
    showWindowHotkey: settings.showWindowHotkey,
  });

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
    if (!items.length || copyInFlight.current) return;
    const images = items.flatMap((item) => item.attachments);
    const texts = asList
      ? [
          items
            .filter((item) => item.text)
            .map((item) => `- ${item.text.replace(/\n/g, "\n  ")}`)
            .join("\n"),
        ].filter(Boolean)
      : items.map((item) => item.text).filter(Boolean);
    const entryCount = images.length + texts.length;
    if (!entryCount) return;
    const statusId = ++toastId.current;
    copyInFlight.current = true;
    setCopyingItems(true);
    setToasts((current) => [
      ...current.slice(-2),
      {
        id: statusId,
        message: `Copying ${entryCount} clipboard ${entryCount === 1 ? "entry" : "entries"}…`,
        kind: "loading",
      },
    ]);

    const finishStatus = (
      message: string,
      kind: ToastMessage["kind"] = "default",
    ) => {
      setToasts((current) =>
        current.map((toast) =>
          toast.id === statusId ? { ...toast, message, kind } : toast,
        ),
      );
      window.setTimeout(
        () =>
          setToasts((current) =>
            current.filter((toast) => toast.id !== statusId),
          ),
        2600,
      );
    };

    try {
      await copyItemsToClipboardHistory(images, texts);
      finishStatus(
        `Copied ${entryCount} clipboard ${entryCount === 1 ? "entry" : "entries"}`,
      );
    } catch {
      finishStatus("Clipboard access was unavailable.", "error");
    } finally {
      copyInFlight.current = false;
      setCopyingItems(false);
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
    if (!content.trim()) {
      notify("There is nothing to export.");
      return;
    }
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
        setFocusedItemId(null);
        setSelected(allVisibleItems.map((item) => item.id));
      } else if (event.key === "Delete" && selectedIds.length) {
        event.preventDefault();
        deleteItems();
      } else if (event.key === " " && selectedIds.length) {
        event.preventDefault();
        selectedIds.forEach(toggleItem);
      } else if (event.key === "Enter" && focusedItemId) {
        const item = sections
          .flatMap((section) => section.items)
          .find((candidate) => candidate.id === focusedItemId);
        if (item) {
          event.preventDefault();
          startEditing(item);
          clearSelected();
        }
      } else if (event.key === "Escape") {
        clearSelected();
        setFocusedItemId(null);
        setContextMenu(null);
        setPasteMenu(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    allVisibleItems,
    clearSelected,
    deleteItems,
    focusedItemId,
    sections,
    selectedIds,
    setSelected,
    startEditing,
    toggleItem,
  ]);

  useEffect(() => {
    if (!contextMenu && !pasteMenu) return;
    const close = () => {
      setContextMenu(null);
      setPasteMenu(null);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
    };
  }, [contextMenu, pasteMenu]);

  function startWindowDrag(event: PointerEvent<HTMLElement>) {
    if (!isTauri() || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (
      target.closest(
        "button, input, textarea, label, a, [role], [data-note-card], [data-no-window-drag]",
      )
    ) {
      return;
    }
    const scrollArea = target.closest<HTMLElement>("[data-notes-scroll]");
    if (
      scrollArea &&
      event.clientX >= scrollArea.getBoundingClientRect().right - 14
    ) {
      return;
    }
    void getCurrentWindow().startDragging();
  }

  function sectionForItem(itemId: string) {
    return sections.find((section) =>
      section.items.some((item) => item.id === itemId),
    );
  }

  function openContextMenu(event: MouseEvent, itemId: string) {
    event.preventDefault();
    setPasteMenu(null);
    if (!selectedIds.includes(itemId)) {
      clearSelected();
      setFocusedItemId(itemId);
    }
    setContextMenu({
      x: Math.min(event.clientX, window.innerWidth - 220),
      y: Math.min(event.clientY, window.innerHeight - 320),
      itemId,
      itemIds: selectedIds.includes(itemId) ? [...selectedIds] : [itemId],
    });
  }

  function openPasteMenu(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (
      target.closest(
        "button, input, textarea, label, a, [role], [data-note-card]",
      )
    ) {
      return;
    }
    event.preventDefault();
    setContextMenu(null);
    setPasteMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 188)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 56)),
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

  async function openComposerImage(index: number) {
    try {
      const newAttachments: CarbonAttachment[] = await Promise.all(
        draftImages.map(async (image) => ({
          id: image.id,
          path: await fileAsDataUrl(image.file),
          mimeType: image.file.type,
          width: image.width,
          height: image.height,
        })),
      );
      await showImageViewer({
        attachments: [...existingAttachments, ...newAttachments],
        index,
      });
    } catch {
      notify("Carbon couldn’t open that image.", "error");
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
      <main className="flex h-full items-center justify-center rounded-2xl border border-line bg-canvas text-muted">
        <div className="flex flex-col items-center gap-3">
          <span className="inline-flex size-11 animate-pulse items-center justify-center rounded-2xl border border-line bg-surface-raised text-accent shadow-sm">
            <Icon icon={SparklesIcon} size={20} />
          </span>
          <p className="m-0 text-xs">Opening Carbon…</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-canvas shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
      onPointerDown={startWindowDrag}
      onContextMenu={openPasteMenu}
    >
      <div
        className="absolute inset-x-14 top-0 z-10 h-2"
        data-tauri-drag-region
      />

      <AppHeader
        activeName={activeName}
        itemCount={itemCount}
        query={query}
        searchRef={searchRef}
        settings={settings}
        onAlwaysOnTopChange={(alwaysOnTop) =>
          updateSettings({ alwaysOnTop })
        }
        onCheckUpdates={() =>
          notify("You’re on the latest development build.")
        }
        onClearQuery={() => setQuery("")}
        onCopyMarkdown={() => void copyMarkdown()}
        onOpenCommands={() => setCommandOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onQueryChange={setQuery}
        onQuit={() => void quitApp()}
        onRevealData={() => void revealLocalData()}
      />

      <NotesView
        captureHotkey={formatShortcut(settings.captureHotkey)}
        captureReady={captureReady}
        focusedItemId={focusedItemId}
        itemCount={itemCount}
        query={query}
        showSectionHeaders={activeSectionId === ALL_SECTIONS}
        selectedIds={selectedIds}
        visibleSections={visibleSections}
        onClearQuery={() => setQuery("")}
        onContextMenu={openContextMenu}
        onDragEnd={handleDragEnd}
        onEdit={(item) => {
          startEditing(item);
          setFocusedItemId(item.id);
          clearSelected();
        }}
        onFocusInput={() => inputRef.current?.focus()}
        onOpenCommands={() => setCommandOpen(true)}
        onOpenImage={(item, index) =>
          void showImageViewer({
            attachments: item.attachments,
            index,
            itemId: item.id,
          })
        }
        onSelect={(itemId, event) => {
          setFocusedItemId(itemId);
          if (event.ctrlKey || event.metaKey) {
            toggleSelected(itemId);
          } else {
            clearSelected();
          }
        }}
        onToggle={toggleItem}
      />

      {selectedItems.length > 0 && (
        <SelectionToolbar
          count={selectedItems.length}
          copying={copyingItems}
          onClear={clearSelected}
          onCopy={() => void copySelectedItems()}
          onDelete={() => deleteItems()}
        />
      )}

      <NoteComposer
        captureSectionName={captureSectionName}
        draft={draft}
        draftImages={draftImages}
        editing={editingItemId !== null}
        existingAttachments={existingAttachments}
        inputRef={inputRef}
        saving={savingDraft}
        onCancelEditing={cancelEditing}
        onDraftChange={setDraft}
        onOpenCommands={() => setCommandOpen(true)}
        onOpenImage={(index) => void openComposerImage(index)}
        onPaste={(event) => void addPastedImages(event)}
        onRemoveDraftImage={removeDraftImage}
        onRemoveExistingImage={removeExistingAttachment}
        onSubmit={() => void submitDraft()}
      />

      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        buckets={sections}
        activeBucketId={activeSectionId}
        onSelectBucket={setActiveSection}
        onCreateBucket={createSection}
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

      {contextMenu && contextItem && (
        <ItemContextMenu
          state={contextMenu}
          item={contextItem}
          selectedItems={contextSelectedItems}
          sections={sections}
          onCopy={(asList) => {
            void copyItems(contextSelectedItems, asList);
            setContextMenu(null);
          }}
          onToggle={() => {
            contextSelectedItems.forEach((item) => toggleItem(item.id));
            setContextMenu(null);
          }}
          onEdit={() => {
            startEditing(contextItem);
            setFocusedItemId(contextItem.id);
            clearSelected();
            setContextMenu(null);
          }}
          onMove={(sectionId) => {
            moveItems(
              contextSelectedItems.map((item) => item.id),
              sectionId,
            );
            setContextMenu(null);
          }}
          onDelete={() => {
            deleteItems(contextSelectedItems.map((item) => item.id));
            setContextMenu(null);
          }}
        />
      )}

      {pasteMenu && (
        <PasteContextMenu
          x={pasteMenu.x}
          y={pasteMenu.y}
          onPaste={() => void pasteFromClipboard()}
        />
      )}

      <ToastRegion toasts={toasts} />
    </main>
  );
}
