import { FolderOpen, Keyboard, Moon, Sun, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import type { CarbonSettings, Theme } from "../lib/model";
import { formatShortcut } from "../lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent } from "./ui/dialog";
import { Switch } from "./ui/switch";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: CarbonSettings;
  dataPath: string;
  onUpdate: (settings: Partial<CarbonSettings>) => void;
  onChooseDataPath: () => Promise<void>;
  onRevealData: () => void;
}

const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  dataPath,
  onUpdate,
  onChooseDataPath,
  onRevealData,
}: SettingsDialogProps) {
  const [hotkey, setHotkey] = useState(settings.captureHotkey);

  useEffect(() => setHotkey(settings.captureHotkey), [settings.captureHotkey]);

  function commitHotkey() {
    const normalized = hotkey.trim().replace(/\s+/g, "");
    if (normalized && normalized !== settings.captureHotkey) {
      onUpdate({ captureHotkey: normalized });
    } else {
      setHotkey(settings.captureHotkey);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Settings"
        description="Carbon stays local and keeps out of your way."
      >
        <div className="settings-stack">
          <section className="settings-section">
            <h3>Appearance</h3>
            <div className="theme-picker" role="radiogroup" aria-label="Theme">
              {themes.map(({ value, label, icon: Icon }) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={settings.theme === value}
                  className={
                    settings.theme === value ? "theme-option active" : "theme-option"
                  }
                  key={value}
                  onClick={() => onUpdate({ theme: value })}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section settings-row">
            <div>
              <h3>Always on top</h3>
              <p>Keep Carbon visible over your current workspace.</p>
            </div>
            <Switch
              checked={settings.alwaysOnTop}
              onCheckedChange={(alwaysOnTop) => onUpdate({ alwaysOnTop })}
              aria-label="Always on top"
            />
          </section>

          <section className="settings-section">
            <div className="settings-label-row">
              <div>
                <h3>Capture shortcut</h3>
                <p>Copies the current selection into the active section.</p>
              </div>
              <Keyboard size={17} />
            </div>
            <input
              className="settings-input"
              value={hotkey}
              onChange={(event) => setHotkey(event.target.value)}
              onBlur={commitHotkey}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              aria-label="Capture shortcut"
            />
            <span className="settings-hint">
              Current: {formatShortcut(settings.captureHotkey)}
            </span>
          </section>

          <section className="settings-section">
            <div className="settings-label-row">
              <div>
                <h3>Local data file</h3>
                <p className="data-path" title={dataPath}>
                  {dataPath}
                </p>
              </div>
              <FolderOpen size={17} />
            </div>
            <div className="settings-actions">
              <Button variant="outline" size="sm" onClick={onRevealData}>
                Reveal
              </Button>
              <Button variant="outline" size="sm" onClick={onChooseDataPath}>
                Change location
              </Button>
            </div>
          </section>

          <div className="privacy-note">
            <span className="privacy-dot" />
            No account, telemetry, analytics, or content network requests.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
