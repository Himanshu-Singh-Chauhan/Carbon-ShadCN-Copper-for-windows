import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Copy01Icon,
  FileEditIcon,
  FolderOpenIcon,
  Moon02Icon,
  Sun02Icon,
} from "@hugeicons/core-free-icons";
import type { CarbonSettings, Theme } from "../lib/model";
import { cn } from "../lib/utils";
import { ShortcutRecorder } from "./ShortcutRecorder";
import { Button } from "./ui/button";
import { Dialog, DialogContent } from "./ui/dialog";
import { Icon, type IconData } from "./ui/icon";
import { Switch } from "./ui/switch";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: CarbonSettings;
  dataPath: string;
  onUpdate: (settings: Partial<CarbonSettings>) => void;
  onShortcutRecordingChange: (recording: boolean) => void;
  onChooseDataPath: () => Promise<void>;
  onRevealData: () => void;
}

const themes: { value: Theme; label: string; icon: IconData }[] = [
  { value: "light", label: "Light", icon: Sun02Icon },
  { value: "dark", label: "Dark", icon: Moon02Icon },
];

const sectionStyles = "p-3";

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  dataPath,
  onUpdate,
  onShortcutRecordingChange,
  onChooseDataPath,
  onRevealData,
}: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[366px]"
        title="Settings"
        description="Local, private, and out of your way."
      >
        <div className="min-w-0 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          <section className={sectionStyles}>
            <h3 className="mb-2 text-sm font-semibold text-ink">Appearance</h3>
            <div
              className="grid min-w-0 grid-cols-[repeat(2,minmax(0,1fr))] gap-1 rounded-xl bg-surface-hover p-1"
              role="radiogroup"
              aria-label="Theme"
            >
              {themes.map(({ value, label, icon }) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={settings.theme === value}
                  className={cn(
                    "inline-flex h-9 min-w-0 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-lg border text-sm font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-accent/35",
                    settings.theme === value
                      ? "border-line bg-surface-raised text-ink shadow-sm"
                      : "border-transparent text-muted hover:text-ink",
                  )}
                  key={value}
                  onClick={() => onUpdate({ theme: value })}
                >
                  <Icon className="shrink-0" icon={icon} size={15} />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className={sectionStyles}>
            <h3 className="mb-3 text-sm font-semibold text-ink">Notes</h3>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">Link previews</p>
                <p className="mt-0.5 text-xs leading-4 text-muted">
                  Show cached page details below links.
                </p>
              </div>
              <Switch
                checked={settings.showLinkPreviews}
                onCheckedChange={(showLinkPreviews) =>
                  onUpdate({ showLinkPreviews })
                }
                aria-label="Show link previews"
              />
            </div>
            <div className="my-3 h-px bg-line" />
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">Date added</p>
                <p className="mt-0.5 text-xs leading-4 text-muted">
                  Show when each note was created.
                </p>
              </div>
              <Switch
                checked={settings.showCreatedAt}
                onCheckedChange={(showCreatedAt) =>
                  onUpdate({ showCreatedAt })
                }
                aria-label="Show date added"
              />
            </div>
            <div className="my-3 h-px bg-line" />
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">Capture source</p>
                <p className="mt-0.5 text-xs leading-4 text-muted">
                  Show the originating app on notes.
                </p>
              </div>
              <Switch
                checked={settings.showItemSources}
                onCheckedChange={(showItemSources) =>
                  onUpdate({ showItemSources })
                }
                aria-label="Show capture source"
              />
            </div>
            <div className="my-3 h-px bg-line" />
            <div>
              <p className="text-sm font-medium text-ink">New captures</p>
              <p className="mt-0.5 text-xs leading-4 text-muted">
                Choose where shortcut captures appear.
              </p>
              <div
                className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-surface-hover p-1"
                role="radiogroup"
                aria-label="New capture placement"
              >
                {[
                  { value: "top" as const, label: "Top", icon: ArrowUp01Icon },
                  {
                    value: "bottom" as const,
                    label: "Bottom",
                    icon: ArrowDown01Icon,
                  },
                ].map((placement) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={
                      settings.capturePlacement === placement.value
                    }
                    className={cn(
                      "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border text-sm font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-accent/35",
                      settings.capturePlacement === placement.value
                        ? "border-line bg-surface-raised text-ink shadow-sm"
                        : "border-transparent text-muted hover:text-ink",
                    )}
                    key={placement.value}
                    onClick={() =>
                      onUpdate({ capturePlacement: placement.value })
                    }
                  >
                    <Icon icon={placement.icon} size={15} />
                    {placement.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="my-3 h-px bg-line" />
            <div>
              <p className="text-sm font-medium text-ink">Double-click</p>
              <p className="mt-0.5 text-xs leading-4 text-muted">
                Choose what happens when a note is double-clicked.
              </p>
              <div
                className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-surface-hover p-1"
                role="radiogroup"
                aria-label="Double-click action"
              >
                {[
                  { value: "copy" as const, label: "Copy", icon: Copy01Icon },
                  { value: "edit" as const, label: "Edit", icon: FileEditIcon },
                ].map((action) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={settings.doubleClickAction === action.value}
                    className={cn(
                      "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border text-sm font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-accent/35",
                      settings.doubleClickAction === action.value
                        ? "border-line bg-surface-raised text-ink shadow-sm"
                        : "border-transparent text-muted hover:text-ink",
                    )}
                    key={action.value}
                    onClick={() =>
                      onUpdate({ doubleClickAction: action.value })
                    }
                  >
                    <Icon icon={action.icon} size={15} />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section
            className={cn(
              sectionStyles,
              "flex items-center justify-between gap-4",
            )}
          >
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-ink">Always on top</h3>
              <p className="mt-0.5 text-xs leading-4 text-muted">
                Keep Carbon above other windows.
              </p>
            </div>
            <Switch
              checked={settings.alwaysOnTop}
              onCheckedChange={(alwaysOnTop) => onUpdate({ alwaysOnTop })}
              aria-label="Always on top"
            />
          </section>

          <section className={sectionStyles}>
            <h3 className="mb-3 text-sm font-semibold text-ink">
              Keyboard shortcuts
            </h3>
            <ShortcutRecorder
              label="Capture selection"
              description="Save selected text without touching clipboard history."
              value={settings.captureHotkey}
              reservedValue={settings.showWindowHotkey}
              reservedLabel="Show Carbon"
              onChange={(captureHotkey) => onUpdate({ captureHotkey })}
              onRecordingChange={onShortcutRecordingChange}
            />
            <div className="my-3 h-px bg-line" />
            <ShortcutRecorder
              label="Show Carbon"
              description="Bring the main window to the front."
              value={settings.showWindowHotkey}
              reservedValue={settings.captureHotkey}
              reservedLabel="Capture selection"
              onChange={(showWindowHotkey) => onUpdate({ showWindowHotkey })}
              onRecordingChange={onShortcutRecordingChange}
            />
          </section>

          <section className={sectionStyles}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-ink">
                  Local data file
                </h3>
                <p
                  className="mt-0.5 truncate text-xs leading-4 text-muted"
                  title={dataPath}
                >
                  {dataPath}
                </p>
              </div>
              <Icon
                className="shrink-0 text-faint"
                icon={FolderOpenIcon}
                size={17}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={onRevealData}>
                Reveal
              </Button>
              <Button variant="outline" size="sm" onClick={onChooseDataPath}>
                Change location
              </Button>
            </div>
          </section>
        </div>

        <div className="mt-3 flex min-w-0 items-start gap-2 px-1 text-xs leading-4 text-muted">
          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />
          <span>No accounts, telemetry, analytics, or network storage.</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
