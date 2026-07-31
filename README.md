# Carbon - (ShadCN Copper for windows)

just leave a star if you liked it.

Carbon is a small Windows companion for capturing selected text, organizing
prompts, and keeping follow-up work nearby. Everything is stored locally.

Built with Tauri 2, React, TypeScript, Tailwind CSS, Zustand, dnd-kit, and `fzf`.

## Features

- Global selected-text capture with `Ctrl+Shift+C`
- UI Automation, Scintilla, and Win32 Edit/RichEdit capture providers
- Sections, fuzzy search, drag ordering, completion, and multi-select copying
- Command palette, system tray, always-on-top mode, and light/dark themes
- Local JSON storage with no accounts, telemetry, or content network requests

Capture does not send `Ctrl+C` or modify clipboard history. Some secure or
custom-rendered applications may not expose their selection to Windows.

## Development

Requirements: Node.js 20+, Rust stable, WebView2, and Microsoft C++ Build Tools.

```powershell
npm install
npm run tauri dev
```

Checks:

```powershell
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo check --manifest-path src-tauri/Cargo.toml
```

## Windows builds

Build the executable without installers:

```powershell
npm run tauri build -- --no-bundle
```

Build both NSIS and MSI installers:

```powershell
npm run tauri build
```

Build one installer type:

```powershell
npm run tauri build -- --bundles nsis
npm run tauri build -- --bundles msi
```

Outputs are written under `src-tauri/target/release/`.

## Storage

Carbon stores `carbon-data.json` in its app-data directory by default. The file
location can be revealed or changed from Settings.

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
