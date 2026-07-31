# Carbon Agent Notes

Carbon is a local-only Windows utility built with Tauri 2, React, and TypeScript.

## Working rules

- Keep note content local. Do not add accounts, telemetry, analytics, or content APIs.
- Selection capture must not send `Ctrl+C` or modify clipboard history.
- Keep native behavior in `src-tauri` and UI/state code in `src`.
- Do not start dev servers or build installers unless the user asks.
- Preserve the compact, keyboard-first interface.

## Checks

```powershell
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo check --manifest-path src-tauri/Cargo.toml
```
