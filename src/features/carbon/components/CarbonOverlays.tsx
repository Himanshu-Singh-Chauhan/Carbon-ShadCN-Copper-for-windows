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
import type { ContextMenuState, ToastMessage } from "../types";

type CarbonOverlaysProps = {
  activeSectionId: string;
  commandOpen: boolean;
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
  onCreateSection: (name: string) => void;
  onOpenCommandChange: (open: boolean) => void;
  onOpenSettings: () => void;
  onPaste: () => void;
  onRevealData: () => void;
  onSelectSection: (sectionId: string) => void;
  onSettingsOpenChange: (open: boolean) => void;
  onThemeChange: (theme: Theme) => void;
  onUpdateSettings: (patch: Partial<CarbonSettings>) => void;
};

export function CarbonOverlays({
  activeSectionId,
  commandOpen,
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
  onCreateSection,
  onOpenCommandChange,
  onOpenSettings,
  onPaste,
  onRevealData,
  onSelectSection,
  onSettingsOpenChange,
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
        onOpenSettings={onOpenSettings}
        onSetTheme={onThemeChange}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={onSettingsOpenChange}
        settings={settings}
        dataPath={dataPath}
        onUpdate={onUpdateSettings}
        onChooseDataPath={onChooseDataPath}
        onRevealData={onRevealData}
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

      <ToastRegion toasts={toasts} />
    </>
  );
}
