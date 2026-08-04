import { SparklesIcon } from "@hugeicons/core-free-icons";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  useCallback,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Icon } from "../../components/ui/icon";
import {
  ALL_SECTIONS,
  type CarbonAttachment,
} from "../../lib/model";
import {
  chooseDataPath,
  isTauri,
  minimizeMainWindow,
  quitApp,
  revealDataFile,
  saveDocument,
  showImageViewer,
} from "../../lib/native";
import {
  type AddedItem,
  getCarbonDocument,
  useCarbonStore,
} from "../../lib/store";
import { formatShortcut } from "../../lib/utils";
import { setMarkdownTaskChecked } from "../../lib/markdown";
import { AppHeader } from "./components/AppHeader";
import { CarbonOverlays } from "./components/CarbonOverlays";
import { DropOverlay } from "./components/DropOverlay";
import { NoteComposer } from "./components/NoteComposer";
import { NotesView } from "./components/NotesView";
import { SelectionToolbar } from "./components/SelectionToolbar";
import { useCarbonContextMenus } from "./hooks/useCarbonContextMenus";
import { useCarbonKeyboard } from "./hooks/useCarbonKeyboard";
import { useCarbonPersistence } from "./hooks/useCarbonPersistence";
import { useAppToasts } from "./hooks/useAppToasts";
import { useDoneItems } from "./hooks/useDoneItems";
import { useDraftComposer } from "./hooks/useDraftComposer";
import { useDropToAdd } from "./hooks/useDropToAdd";
import { useExternalInputSource } from "./hooks/useExternalInputSource";
import { useFlexiblePaste } from "./hooks/useFlexiblePaste";
import { useItemClipboard } from "./hooks/useItemClipboard";
import { useNativeShortcuts } from "./hooks/useNativeShortcuts";
import { useTheme } from "./hooks/useTheme";
import { useWindowIntegration } from "./hooks/useWindowIntegration";
import { useVisibleNotes } from "./hooks/useVisibleNotes";

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
    doneViewBySection,
    sections,
    settings,
    hydrated,
    selectedIds,
    hydrate,
    addEntry,
    addItem,
    createSection,
    deleteSection,
    setActiveSection,
    setItemsCompleted,
    removeItemSource,
    updateItem,
    deleteItems,
    moveItems,
    reorderItem,
    setSectionSortMode,
    setDoneViewMode,
    setSelected,
    toggleSelected,
    clearSelected,
    updateSettings,
  } = useCarbonStore();

  const [query, setQuery] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutRecording, setShortcutRecording] = useState(false);
  const [deleteDoneOpen, setDeleteDoneOpen] = useState(false);
  const [dataPath, setDataPath] = useState("Loading local data…");
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [captureReady, setCaptureReady] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const doneViewMode = doneViewBySection[activeSectionId] ?? "active";
  const {
    dismissToast,
    notify,
    notifyWithAction,
    setToasts,
    toastId,
    toasts,
  } = useAppToasts();
  const {
    contextItem,
    contextMenu,
    contextSelectedItems,
    handleDragEnd,
    openContextMenu,
    openPasteMenu,
    pasteMenu,
    setContextMenu,
    setPasteMenu,
  } = useCarbonContextMenus({
    clearSelected,
    reorderItem,
    sections,
    selectedIds,
    setFocusedItemId,
  });

  const { setDoneState, setDoneStateForIds } = useDoneItems({
    clearSelected,
    notify,
    notifyWithAction,
    setFocusedItemId,
    setItemsCompleted,
  });

  const revealAddedItem = useCallback(
    (added: AddedItem) => {
      if (
        (useCarbonStore.getState().doneViewBySection[activeSectionId] ??
          "active") === "done"
      ) {
        setDoneViewMode(activeSectionId, "active");
      }
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
    [activeSectionId, clearSelected, setDoneViewMode],
  );

  const revealPastedItem = useCallback(
    (added: AddedItem) => {
      setPasteMenu(null);
      revealAddedItem(added);
    },
    [revealAddedItem],
  );

  const {
    addDroppedImages,
    addPastedImages,
    cancelEditing,
    draft,
    draftImages,
    editingItemId,
    existingAttachments,
    inputRef,
    removeDraftImage,
    removeExistingAttachment,
    rememberDroppedTextSource,
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
  const { dropActive, dropHandlers } = useDropToAdd({
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
  useExternalInputSource(hydrated);
  useNativeShortcuts({
    captureHotkey: settings.captureHotkey,
    enabled: !shortcutRecording,
    hydrated,
    notify,
    onReadyChange: setCaptureReady,
    showWindowHotkey: settings.showWindowHotkey,
  });

  const {
    allVisibleItems,
    clearSourceFilter,
    clearSourceFilterFor,
    doneCount,
    itemCount,
    selectedSourceKeys,
    sourceFilterOptions,
    sourceSections,
    toggleSourceFilter,
    viewItemCount,
    visibleSections,
  } = useVisibleNotes({
    activeSectionId,
    doneViewMode,
    query,
    sections,
  });

  const navigateToItem = useCallback(
    ({ bucketId, itemId }: { bucketId: string; itemId: string }) => {
      setCommandOpen(false);
      setSettingsOpen(false);
      setDeleteDoneOpen(false);
      setActiveSection(bucketId);
      setDoneViewMode(bucketId, "active");
      clearSourceFilterFor(bucketId);
      setQuery("");
      clearSelected();
      setFocusedItemId(itemId);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const card = Array.from(
            document.querySelectorAll<HTMLElement>("[data-item-id]"),
          ).find((element) => element.dataset.itemId === itemId);
          card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      });
    },
    [
      clearSelected,
      clearSourceFilterFor,
      setActiveSection,
      setDoneViewMode,
    ],
  );

  useWindowIntegration({
    hydrated,
    settings,
    updateSettings,
    notify,
    onNavigateToItem: navigateToItem,
  });

  const {
    copyItems,
    copyMarkdown,
    copySelectedItems,
    copyingItems,
    selectedItems,
  } = useItemClipboard({
    notify,
    sections,
    selectedIds,
    setToasts,
    sourceSections,
    toastId,
  });

  useCarbonKeyboard({
    allVisibleItems,
    clearSelected,
    copySelectedItems,
    deleteItems,
    focusedItemId,
    searchRef,
    sections,
    selectedIds,
    setCommandOpen,
    setContextMenu,
    setFocusedItemId,
    setPasteMenu,
    setSelected,
    setSettingsOpen,
    startEditing,
    toggleItems: setDoneStateForIds,
  });

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

  async function minimizeToTray() {
    if (
      draft.trim() ||
      draftImages.length > 0 ||
      existingAttachments.length > 0 ||
      editingItemId
    ) {
      notify("Finish or cancel the current draft before minimizing.", "error");
      return;
    }
    try {
      await saveDocument(getCarbonDocument());
      await minimizeMainWindow();
    } catch (error) {
      notify(`Couldn’t minimize Carbon: ${String(error)}`, "error");
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
          sourceUrl: image.sourceUrl,
          pageUrl: image.pageUrl,
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

  const activeSection =
    activeSectionId === ALL_SECTIONS
      ? undefined
      : sections.find((section) => section.id === activeSectionId);
  const activeName =
    activeSectionId === ALL_SECTIONS
      ? "All notes"
      : activeSection?.name ?? "Inbox";
  const captureSectionName =
    activeSectionId === ALL_SECTIONS
      ? sections[0]?.name ?? "Inbox"
      : activeName;
  const doneItemsInScope = sourceSections.flatMap((section) =>
    section.items.filter((item) => item.completed),
  );
  const deleteDoneScopeName =
    activeSectionId === ALL_SECTIONS ? "all buckets" : activeName;
  if (!hydrated) {
    return (
      <main className="flex h-full items-center justify-center rounded-2xl border border-line bg-canvas text-muted ring-4 ring-inset ring-line/60">
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
      className="relative flex h-full w-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-line bg-canvas shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] ring-4 ring-inset ring-line/60"
      onPointerDown={startWindowDrag}
      onContextMenu={openPasteMenu}
      {...dropHandlers}
    >
      <div
        className="absolute inset-x-14 top-0 z-10 h-2"
        data-tauri-drag-region
      />

      <AppHeader
        activeBucketId={activeSectionId}
        activeName={activeName}
        buckets={sections}
        doneCount={doneCount}
        doneViewMode={doneViewMode}
        itemCount={viewItemCount}
        query={query}
        searchRef={searchRef}
        settings={settings}
        sortMode={activeSection?.sortMode}
        sourceFilterOptions={sourceFilterOptions}
        selectedSourceKeys={selectedSourceKeys}
        onAlwaysOnTopChange={(alwaysOnTop) =>
          updateSettings({ alwaysOnTop })
        }
        onCheckUpdates={() =>
          notify("You’re on the latest development build.")
        }
        onClearQuery={() => setQuery("")}
        onClearSourceFilter={clearSourceFilter}
        onCopyMarkdown={() => void copyMarkdown()}
        onDeleteAllDone={() => setDeleteDoneOpen(true)}
        onDoneViewModeChange={(mode) =>
          setDoneViewMode(activeSectionId, mode)
        }
        onOpenCommands={() => setCommandOpen(true)}
        onMinimizeToTray={() => void minimizeToTray()}
        onOpenSettings={() => setSettingsOpen(true)}
        onQueryChange={setQuery}
        onQuit={() => void quitApp()}
        onRevealData={() => void revealLocalData()}
        onSelectBucket={setActiveSection}
        onSortModeChange={
          activeSection
            ? (sortMode) => setSectionSortMode(activeSection.id, sortMode)
            : undefined
        }
        onToggleSourceFilter={toggleSourceFilter}
      />

      <NotesView
        captureHotkey={formatShortcut(settings.captureHotkey)}
        captureReady={captureReady}
        focusedItemId={focusedItemId}
        itemCount={itemCount}
        viewItemCount={viewItemCount}
        doneViewMode={doneViewMode}
        query={query}
        showCreatedAt={settings.showCreatedAt}
        showItemSources={settings.showItemSources}
        showLinkPreviews={settings.showLinkPreviews}
        showSectionHeaders={activeSectionId === ALL_SECTIONS}
        selectedIds={selectedIds}
        visibleSections={visibleSections}
        onClearQuery={() => setQuery("")}
        onContextMenu={openContextMenu}
        onDragEnd={handleDragEnd}
        onEdit={(item) => {
          if (settings.doubleClickAction === "copy") {
            void copyItems([item]);
            return;
          }
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
        onSortModeChange={setSectionSortMode}
        onTaskToggle={(item, taskIndex, checked) =>
          updateItem(
            item.id,
            setMarkdownTaskChecked(item.text, taskIndex, checked),
          )
        }
        onToggle={(itemId) => {
          const item = sections
            .flatMap((section) => section.items)
            .find((candidate) => candidate.id === itemId);
          if (item) setDoneState([item], !item.completed);
        }}
      />

      {selectedItems.length > 0 && (
        <SelectionToolbar
          count={selectedItems.length}
          copying={copyingItems}
          onClear={clearSelected}
          onCopy={() => void copySelectedItems()}
          onDelete={() => deleteItems()}
          onToggleDone={() => setDoneState(selectedItems)}
          toggleDoneLabel={
            selectedItems.every((item) => item.completed) ? "Restore" : "Done"
          }
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
        onDropImages={(data) => void addDroppedImages(data)}
        onDropTextSource={rememberDroppedTextSource}
        onOpenCommands={() => setCommandOpen(true)}
        onOpenImage={(index) => void openComposerImage(index)}
        onPaste={addPastedImages}
        onRemoveDraftImage={removeDraftImage}
        onRemoveExistingImage={removeExistingAttachment}
        onSubmit={(value) => void submitDraft(value)}
      />

      {dropActive && <DropOverlay />}

      <CarbonOverlays
        activeSectionId={activeSectionId}
        commandOpen={commandOpen}
        deleteDoneCount={doneCount}
        deleteDoneOpen={deleteDoneOpen}
        deleteDoneScopeName={deleteDoneScopeName}
        contextItem={contextItem}
        contextMenu={contextMenu}
        contextSelectedItems={contextSelectedItems}
        dataPath={dataPath}
        pasteMenu={pasteMenu}
        sections={sections}
        settings={settings}
        settingsOpen={settingsOpen}
        toasts={toasts}
        onChooseDataPath={changeDataPath}
        onContextCopy={(asList) => {
          void copyItems(contextSelectedItems, asList);
          setContextMenu(null);
        }}
        onContextDelete={() => {
          deleteItems(contextSelectedItems.map((item) => item.id));
          setContextMenu(null);
        }}
        onContextEdit={() => {
          if (!contextItem) return;
          startEditing(contextItem);
          setFocusedItemId(contextItem.id);
          clearSelected();
          setContextMenu(null);
        }}
        onContextMove={(sectionId) => {
          moveItems(
            contextSelectedItems.map((item) => item.id),
            sectionId,
          );
          setContextMenu(null);
        }}
        onContextRemoveSource={() => {
          if (!contextItem) return;
          removeItemSource(contextItem.id);
          setContextMenu(null);
        }}
        onContextToggle={() => {
          setDoneState(
            contextSelectedItems,
            contextItem ? !contextItem.completed : undefined,
          );
          setContextMenu(null);
        }}
        onDeleteAllDone={() => {
          deleteItems(doneItemsInScope.map((item) => item.id));
          notify(
            doneItemsInScope.length === 1
              ? "Deleted Done item"
              : `Deleted ${doneItemsInScope.length} Done items`,
          );
        }}
        onDeleteDoneOpenChange={setDeleteDoneOpen}
        onDismissToast={dismissToast}
        onCreateSection={createSection}
        onDeleteSection={(sectionId) => {
          const section = sections.find(
            (candidate) => candidate.id === sectionId,
          );
          deleteSection(sectionId);
          if (section) notify(`Deleted ${section.name}`);
        }}
        onOpenCommandChange={setCommandOpen}
        onOpenSettings={() => setSettingsOpen(true)}
        onPaste={() => void pasteFromClipboard()}
        onRevealData={() => void revealLocalData()}
        onSelectSection={setActiveSection}
        onSettingsOpenChange={setSettingsOpen}
        onShortcutRecordingChange={setShortcutRecording}
        onThemeChange={(theme) => updateSettings({ theme })}
        onUpdateSettings={updateSettings}
      />
    </main>
  );
}
