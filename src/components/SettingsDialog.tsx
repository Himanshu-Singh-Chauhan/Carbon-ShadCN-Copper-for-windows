import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  Copy01Icon,
  FileEditIcon,
  FolderOpenIcon,
  Moon02Icon,
  Sun02Icon,
} from "@hugeicons/core-free-icons";
import { useRef, useState } from "react";
import { useAssetUrl } from "./AssetImage";
import { appBackgrounds } from "../lib/appBackgrounds";
import type {
  CarbonSettings,
  CustomAppBackground,
  Theme,
} from "../lib/model";
import { saveImageAsset } from "../lib/native";
import { cn, createId } from "../lib/utils";
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
  onEditBackground: () => void;
  onShortcutRecordingChange: (recording: boolean) => void;
  onChooseDataPath: () => Promise<void>;
  onRevealData: () => void;
}

const themes: { value: Theme; label: string; icon: IconData }[] = [
  { value: "light", label: "Light", icon: Sun02Icon },
  { value: "dark", label: "Dark", icon: Moon02Icon },
];

const sectionStyles = "p-3";
const supportedBackgroundTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
]);

function BackgroundChoice({
  value,
  label,
  imageUrl,
  asset,
  selected,
  onSelect,
}: {
  value: string;
  label: string;
  imageUrl?: string;
  asset?: CustomAppBackground;
  selected: boolean;
  onSelect: () => void;
}) {
  const assetUrl = useAssetUrl(asset);
  const previewUrl = imageUrl ?? assetUrl;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={cn(
        "w-[116px] shrink-0 snap-start cursor-pointer overflow-hidden rounded-xl border bg-surface-raised p-1 text-left outline-none transition-[border-color,box-shadow,transform] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent/35",
        selected
          ? "border-accent shadow-sm"
          : "border-line hover:border-line-strong",
      )}
      onClick={onSelect}
    >
      <span
        className={cn(
          "block aspect-[16/9] overflow-hidden rounded-lg border border-line bg-surface-hover",
          !previewUrl &&
            value === "none" &&
            "bg-[linear-gradient(135deg,var(--surface-hover)_25%,var(--surface)_25%,var(--surface)_50%,var(--surface-hover)_50%,var(--surface-hover)_75%,var(--surface)_75%,var(--surface))] bg-[length:12px_12px]",
        )}
      >
        {previewUrl && (
          <img
            className="h-full w-full object-cover"
            src={previewUrl}
            alt=""
          />
        )}
      </span>
      <span className="block truncate px-1 pb-0.5 pt-1.5 text-xs font-medium text-ink">
        {label}
      </span>
    </button>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  dataPath,
  onUpdate,
  onEditBackground,
  onShortcutRecordingChange,
  onChooseDataPath,
  onRevealData,
}: SettingsDialogProps) {
  const backgroundsRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [backgroundError, setBackgroundError] = useState<string>();

  function scrollBackgrounds(direction: -1 | 1) {
    backgroundsRef.current?.scrollBy({
      left: direction * 126,
      behavior: "smooth",
    });
  }

  async function uploadBackground(file: File) {
    setBackgroundError(undefined);
    if (!supportedBackgroundTypes.has(file.type)) {
      setBackgroundError("Choose a PNG, JPEG, WebP, GIF, or BMP image.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setBackgroundError("Background images must be smaller than 25 MB.");
      return;
    }

    setUploadingBackground(true);
    try {
      const id = createId("background");
      const path = await saveImageAsset(
        id,
        file.type,
        new Uint8Array(await file.arrayBuffer()),
      );
      const label =
        file.name.replace(/\.[^.]+$/, "").trim() || "Custom background";
      const background: CustomAppBackground = {
        id,
        label,
        path,
        mimeType: file.type,
      };
      onUpdate({
        customBackgrounds: [...settings.customBackgrounds, background],
        backgroundImage: id,
      });
      window.requestAnimationFrame(() =>
        backgroundsRef.current?.scrollTo({
          left: backgroundsRef.current.scrollWidth,
          behavior: "smooth",
        }),
      );
    } catch (error) {
      setBackgroundError(
        error instanceof Error ? error.message : "Could not add this image.",
      );
    } finally {
      setUploadingBackground(false);
    }
  }

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
            <div className="my-3 h-px bg-line" />
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-muted">Background</p>
              <input
                ref={uploadInputRef}
                className="hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void uploadBackground(file);
                }}
              />
              <button
                type="button"
                className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface-raised px-2 text-xs font-medium text-ink outline-none transition-[border-color,transform] active:scale-[0.97] hover:border-line-strong focus-visible:ring-2 focus-visible:ring-accent/35 disabled:cursor-default disabled:opacity-50"
                disabled={uploadingBackground}
                onClick={() => uploadInputRef.current?.click()}
              >
                <Icon icon={Add01Icon} size={13} />
                {uploadingBackground ? "Adding…" : "Add image"}
              </button>
            </div>
            <div className="flex min-w-0 items-center gap-1.5">
              <button
                type="button"
                className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line bg-surface-raised text-muted outline-none transition-[border-color,transform] active:scale-[0.94] hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35"
                aria-label="Scroll backgrounds left"
                onClick={() => scrollBackgrounds(-1)}
              >
                <Icon icon={ArrowLeft01Icon} size={14} />
              </button>
              <div
                ref={backgroundsRef}
                className="flex min-w-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="radiogroup"
                aria-label="App background"
              >
                {appBackgrounds.map(({ value, label, imageUrl }) => (
                  <BackgroundChoice
                    key={value}
                    value={value}
                    label={label}
                    imageUrl={imageUrl}
                    selected={settings.backgroundImage === value}
                    onSelect={() => onUpdate({ backgroundImage: value })}
                  />
                ))}
                {settings.customBackgrounds.map((background) => (
                  <BackgroundChoice
                    key={background.id}
                    value={background.id}
                    label={background.label}
                    asset={background}
                    selected={settings.backgroundImage === background.id}
                    onSelect={() =>
                      onUpdate({ backgroundImage: background.id })
                    }
                  />
                ))}
              </div>
              <button
                type="button"
                className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line bg-surface-raised text-muted outline-none transition-[border-color,transform] active:scale-[0.94] hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/35"
                aria-label="Scroll backgrounds right"
                onClick={() => scrollBackgrounds(1)}
              >
                <Icon icon={ArrowRight01Icon} size={14} />
              </button>
            </div>
            <button
              type="button"
              className="mt-2 inline-flex h-8 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-surface-raised text-xs font-medium text-ink outline-none transition-[border-color,transform] active:scale-[0.99] hover:border-line-strong focus-visible:ring-2 focus-visible:ring-accent/35 disabled:cursor-default disabled:opacity-45"
              disabled={settings.backgroundImage === "none"}
              onClick={onEditBackground}
            >
              <Icon icon={FileEditIcon} size={14} />
              Edit position
            </button>
            {backgroundError && (
              <p className="mt-2 text-[11px] leading-4 text-danger">
                {backgroundError}
              </p>
            )}
            <div
              className={cn(
                "mt-3 rounded-xl border border-line bg-surface-raised px-3 py-2.5 transition-opacity",
                settings.backgroundImage === "none" && "opacity-50",
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-ink">Card blur</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted">
                    Soften the image behind note cards.
                  </p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  {settings.backgroundBlur}px
                </span>
              </div>
              <input
                className="block h-4 w-full cursor-pointer accent-accent disabled:cursor-default"
                type="range"
                min="0"
                max="100"
                step="1"
                value={settings.backgroundBlur}
                disabled={settings.backgroundImage === "none"}
                aria-label="Card background blur"
                onChange={(event) =>
                  onUpdate({ backgroundBlur: Number(event.target.value) })
                }
              />
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
