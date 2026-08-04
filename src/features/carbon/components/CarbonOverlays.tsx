import { CommandPalette } from "../../../components/CommandPalette";
import { SettingsDialog } from "../../../components/SettingsDialog";
import type {
  CarbonItem,
  CarbonSection,
  CarbonSettings,
  Theme,
} from "../../../lib/model";
import { ItemContextMenu } from "./ItemContextMenu";
import { PasteContextMenu } from "./PasteContextMenu";
import { ToastRegion } from "./ToastRegion";
import { DeleteDoneDialog } from "./DeleteDoneDialog";
import type { ContextMenuState, ToastMessage } from "../types";

type CarbonOverlaysProps = {
  activeSectionId: string;
  commandOpen: boolean;
  deleteDoneCount: number;
  deleteDoneOpen: boolean;
  deleteDoneScopeName: string;
  contextItem?: CarbonItem;
  contextMenu: ContextMenuState;
  contextSelectedItems: CarbonItem[];
  dataPath: string;
  pasteMenu: { x: number; y: number } | null;
  sections: CarbonSection[];
  settings: CarbonSettings;
  settingsOpen: boolean;
  toasts: ToastMessage[];
  onChooseDataPath: () => Promise<void>;
  onContextCopy: (asList: boolean) => void;
  onContextDelete: () => void;
  onContextEdit: () => void;
  onContextMove: (sectionId: string) => void;
  onContextRemoveSource: () => void;
  onContextToggle: () => void;
  onDeleteAllDone: () => void;
  onDeleteDoneOpenChange: (open: boolean) => void;
  onDismissToast: (id: number) => void;
  onCreateSection: (name: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onOpenCommandChange: (open: boolean) => void;
  onOpenSettings: () => void;
  onPaste: () => void;
  onRevealData: () => void;
  onSelectSection: (sectionId: string) => void;
  onSettingsOpenChange: (open: boolean) => void;
  onShortcutRecordingChange: (recording: boolean) => void;
  onThemeChange: (theme: Theme) => void;
  onUpdateSettings: (patch: Partial<CarbonSettings>) => void;
};

export function CarbonOverlays({
  activeSectionId,
  commandOpen,
  deleteDoneCount,
  deleteDoneOpen,
  deleteDoneScopeName,
  contextItem,
  contextMenu,
  contextSelectedItems,
  dataPath,
  pasteMenu,
  sections,
  settings,
  settingsOpen,
  toasts,
  onChooseDataPath,
  onContextCopy,
  onContextDelete,
  onContextEdit,
  onContextMove,
  onContextRemoveSource,
  onContextToggle,
  onDeleteAllDone,
  onDeleteDoneOpenChange,
  onDismissToast,
  onCreateSection,
  onDeleteSection,
  onOpenCommandChange,
  onOpenSettings,
  onPaste,
  onRevealData,
  onSelectSection,
  onSettingsOpenChange,
  onShortcutRecordingChange,
  onThemeChange,
  onUpdateSettings,
}: CarbonOverlaysProps) {
  return (
    <>
      <CommandPalette
        open={commandOpen}
        onOpenChange={onOpenCommandChange}
        buckets={sections}
        activeBucketId={activeSectionId}
        onSelectBucket={onSelectSection}
        onCreateBucket={onCreateSection}
        onDeleteBucket={onDeleteSection}
        onOpenSettings={onOpenSettings}
        onSetTheme={onThemeChange}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={onSettingsOpenChange}
        settings={settings}
        dataPath={dataPath}
        onUpdate={onUpdateSettings}
        onShortcutRecordingChange={onShortcutRecordingChange}
        onChooseDataPath={onChooseDataPath}
        onRevealData={onRevealData}
      />

      <DeleteDoneDialog
        count={deleteDoneCount}
        open={deleteDoneOpen}
        scopeName={deleteDoneScopeName}
        onConfirm={onDeleteAllDone}
        onOpenChange={onDeleteDoneOpenChange}
      />

      {contextMenu && contextItem && (
        <ItemContextMenu
          state={contextMenu}
          item={contextItem}
          selectedItems={contextSelectedItems}
          sections={sections}
          onCopy={onContextCopy}
          onToggle={onContextToggle}
          onEdit={onContextEdit}
          onMove={onContextMove}
          onDelete={onContextDelete}
          onRemoveSource={onContextRemoveSource}
        />
      )}

      {pasteMenu && (
        <PasteContextMenu
          x={pasteMenu.x}
          y={pasteMenu.y}
          onPaste={onPaste}
        />
      )}

      <ToastRegion toasts={toasts} onDismiss={onDismissToast} />
    </>
  );
}
