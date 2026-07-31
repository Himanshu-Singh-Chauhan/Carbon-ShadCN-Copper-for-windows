# Carbon

Carbon is a small, keyboard-first Windows companion for capturing useful text,
queuing prompts, and organizing follow-up work without sending your content to
any service.

It is built with Tauri 2, React 19, TypeScript, Tailwind CSS, shadcn-style Radix
primitives, Zustand, dnd-kit, and `fzf`.

## What works

- Capture selected text from another Windows app with `Ctrl+Shift+C`
- Create notes and multi-line prompts from the bottom composer
- Type `# Section Name` to create and switch to a section
- Switch sections and run actions with `Ctrl+K`
- Fuzzy-search the current view using `fzf`
- Check off, edit, delete, move, and drag notes
- Multi-select notes and press `Ctrl+C` to copy them as one prompt block
- Copy the current view as Markdown
- Light, dark, and system themes
- Always-on-top window, system tray, and remembered window bounds
- Human-readable local JSON persistence with a user-selectable location
- No accounts, models, telemetry, analytics, or note-content network requests

## Development

Requirements:

- Node.js 20 or newer
- Rust stable
- Tauri's Windows prerequisites (WebView2 and Microsoft C++ Build Tools)

```powershell
npm install
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

To launch the Tauri development app yourself:

```powershell
npm run tauri dev
```

To create Windows installers:

```powershell
npm run tauri build
```

## Storage and privacy

The default data file is `carbon-data.json` inside Tauri's Carbon app-data
directory. The exact path is shown in Settings, where it can also be revealed or
changed. Writes use a temporary file and rename so an interrupted save is less
likely to corrupt the document.

Carbon makes no content API calls. The “Check for updates” item is intentionally
a local placeholder until an updater endpoint is configured.

## Windows selection capture

Carbon first reads the selected ranges exposed by the focused control through
Windows UI Automation's TextPattern API. Scintilla-based editors such as
Notepad++ use a dedicated native provider based on `SCI_GETSELTEXT`. Neither
provider sends `Ctrl+C`, writes temporary clipboard data, or adds entries to
Windows/Raycast clipboard history.

Not every desktop framework exposes text selection through Windows
Accessibility. Secure, remote-desktop, terminal, canvas-rendered, and some
custom controls may still be unavailable. Carbon reports that limitation
without silently falling back to the clipboard. Running Carbon at the same
integrity level as the source app provides the broadest native access.

The shortcut is configurable in Settings using Tauri shortcut syntax, for
example `CommandOrControl+Alt+C`.

## Keyboard reference

| Shortcut | Action |
| --- | --- |
| `Ctrl+Shift+C` | Capture selected text globally |
| `Ctrl+K` | Open command palette / switch section |
| `Ctrl+F` | Focus fuzzy search |
| `Ctrl+,` | Open Settings |
| `Ctrl+A` | Select all visible notes |
| `Ctrl+C` | Copy selected notes |
| `Space` | Toggle selected notes done |
| `Delete` | Delete selected notes |
| `Enter` | Add composer text |
| `Shift+Enter` | Add a line in the composer |
| `Esc` | Clear selection / dismiss menus |

## Project layout

- `src/lib/model.ts` — persisted schema and migration-safe normalization
- `src/lib/store.ts` — Carbon actions and UI state
- `src/lib/native.ts` — typed Tauri bridge with browser-preview fallback
- `src/components` — panel, command, settings, and shadcn-style UI primitives
- `src-tauri/src/lib.rs` — storage, capture, tray, and native window commands

Image/file attachments have deliberately not been added to the persistence
schema yet. The document is versioned so attachment metadata can be introduced
with a forward migration without breaking existing notes.
