import { KeyboardIcon } from "@hugeicons/core-free-icons";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn, formatShortcut } from "../lib/utils";
import { Icon } from "./ui/icon";

const specialShortcuts = [
  { value: "DoubleShift", label: "Shift Shift" },
  { value: "DoubleControl", label: "Ctrl Ctrl" },
  { value: "DoubleAlt", label: "Alt Alt" },
] as const;

function modifierKey(key: string) {
  if (key === "Shift") return "DoubleShift";
  if (key === "Control" || key === "Meta") return "DoubleControl";
  if (key === "Alt") return "DoubleAlt";
  return null;
}

function acceleratorKey(event: KeyboardEvent<HTMLButtonElement>) {
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3);
  if (/^Digit[0-9]$/.test(event.code)) return event.code.slice(5);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(event.key)) return event.key;

  const keys: Record<string, string> = {
    Space: "Space",
    Enter: "Enter",
    Tab: "Tab",
    Backspace: "Backspace",
    Delete: "Delete",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Comma: "Comma",
    Period: "Period",
    Slash: "Slash",
    Semicolon: "Semicolon",
    Quote: "Quote",
    BracketLeft: "BracketLeft",
    BracketRight: "BracketRight",
    Backslash: "Backslash",
    Minus: "Minus",
    Equal: "Equal",
    Backquote: "Backquote",
  };
  return keys[event.code] ?? null;
}

function recordedShortcut(event: KeyboardEvent<HTMLButtonElement>) {
  const key = acceleratorKey(event);
  if (!key) return null;
  const modifiers = [
    (event.ctrlKey || event.metaKey) && "CommandOrControl",
    event.altKey && "Alt",
    event.shiftKey && "Shift",
  ].filter(Boolean);
  if (modifiers.length === 0 && !key.startsWith("F")) return null;
  return [...modifiers, key].join("+");
}

export function ShortcutRecorder({
  label,
  description,
  value,
  reservedValue,
  reservedLabel,
  onChange,
  onRecordingChange,
}: {
  label: string;
  description: string;
  value: string;
  reservedValue: string;
  reservedLabel: string;
  onChange: (value: string) => void;
  onRecordingChange?: (recording: boolean) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [prompt, setPrompt] = useState("Press shortcut…");
  const [error, setError] = useState<string>();
  const lastModifier = useRef<{ value: string; time: number } | undefined>(
    undefined,
  );

  useEffect(() => {
    setRecording(false);
    onRecordingChange?.(false);
    setError(undefined);
  }, [onRecordingChange, value]);

  useEffect(
    () => () => {
      onRecordingChange?.(false);
    },
    [onRecordingChange],
  );

  function changeRecording(next: boolean) {
    setRecording(next);
    onRecordingChange?.(next);
  }

  function commit(next: string) {
    if (next === reservedValue) {
      setError(`Already used by ${reservedLabel}.`);
      setPrompt("Press another shortcut…");
      return;
    }
    changeRecording(false);
    setError(undefined);
    lastModifier.current = undefined;
    onChange(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      changeRecording(false);
      setPrompt("Press shortcut…");
      lastModifier.current = undefined;
      return;
    }

    const modifier = modifierKey(event.key);
    if (modifier) {
      if (event.repeat) return;
      const now = performance.now();
      if (
        lastModifier.current?.value === modifier &&
        now - lastModifier.current.time <= 650
      ) {
        commit(modifier);
      } else {
        lastModifier.current = { value: modifier, time: now };
        setPrompt(`Press ${formatShortcut(modifier).split(" ")[0]} again…`);
      }
      return;
    }

    lastModifier.current = undefined;
    const shortcut = recordedShortcut(event);
    if (!shortcut) {
      setError("Use a modifier with a key, an F-key, or double-tap below.");
      setPrompt("Press another shortcut…");
      return;
    }
    commit(shortcut);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-ink">{label}</h4>
          <p className="mt-0.5 text-xs leading-4 text-muted">{description}</p>
        </div>
        <Icon className="mt-0.5 shrink-0 text-faint" icon={KeyboardIcon} size={16} />
      </div>
      <button
        type="button"
        className={cn(
          "mt-2 flex h-10 w-full cursor-pointer items-center gap-2 rounded-xl border bg-surface-raised px-3 text-left outline-none transition-[border-color,box-shadow,background-color] focus-visible:ring-2 focus-visible:ring-accent/25",
          recording
            ? "border-accent/60 bg-accent-soft"
            : "border-line hover:border-line-strong hover:bg-surface-hover",
        )}
        aria-label={`${label}: ${formatShortcut(value)}. Click to record a new shortcut.`}
        aria-pressed={recording}
        onBlur={() => {
          changeRecording(false);
          setPrompt("Press shortcut…");
          lastModifier.current = undefined;
        }}
        onClick={() => {
          changeRecording(!recording);
          setPrompt("Press shortcut…");
          setError(undefined);
          lastModifier.current = undefined;
        }}
        onKeyDown={handleKeyDown}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
          {recording ? prompt : formatShortcut(value)}
        </span>
        <span className="shrink-0 text-xs text-faint">
          {recording ? "Esc to cancel" : "Change"}
        </span>
      </button>
      <div className="mt-2 flex min-w-0 gap-1.5" aria-label="Double-tap shortcuts">
        {specialShortcuts.map((shortcut) => (
          <button
            type="button"
            className={cn(
              "min-w-0 flex-1 cursor-pointer rounded-lg border px-1.5 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/25",
              value === shortcut.value
                ? "border-accent/45 bg-accent-soft text-accent"
                : "border-line bg-surface-raised text-muted hover:border-line-strong hover:text-ink",
            )}
            key={shortcut.value}
            onClick={() => commit(shortcut.value)}
          >
            <span className="block truncate">{shortcut.label}</span>
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-1.5 text-xs leading-4 text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
