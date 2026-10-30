# Export Folder to ZIP — Obsidian plugin

Desktop **Obsidian** plugin that compresses vault folders using external system engines (**7-Zip** or **WinRAR**), with progress, cancel, background mode and flexible save options.

> Desktop-only: uses `child_process` to run the system binaries.

## Features

- **Context menu:** right-click a folder → **"Export folder to ZIP"**.
- **External engines:** 7-Zip (`zip`, `7z`, `tar`, `tar.gz`) or WinRAR (`rar`, `zip`), with compression levels tuned per engine.
- **Fixed exclusions:** `.obsidian/*` and `.git/*` never enter the archive.
- **Progress modal:** live percentage with **Cancel** (kills the process and cleans up the temp folder) and **Send to background** (status bar shows progress; click to reopen).
- **Flexible save:** on finish, **"Save next to the folder"** (same level, never inside; timestamp suffix if it already exists — never overwrites) or **"Download"** (native OS save dialog).
- **Settings:** add/edit/remove binaries, search common Windows installs and `PATH`, select the active engine, and choose a format and compression level supported by any configured engine.
- **Optional 7-Zip download:** on explicit user confirmation, download the matching binary from a pinned `develar/7zip-bin` revision. Windows x64/ia32/arm64, macOS x64/arm64, and Linux x64/ia32/arm/arm64 are supported. The plugin verifies its size and SHA-256 and stores it under its own plugin directory (not in the vault or a temporary folder). An alternative HTTPS URL can be configured with a required SHA-256.
- **Localized interface:** follows Obsidian's language setting, with English and Castellano translations.
- **Network and privacy:** no telemetry or vault data is sent. Network access occurs only when the user explicitly starts a binary download: to the pinned GitHub raw URL or to the user-configured HTTPS URL. Downloaded executables run locally with the user's consent.

## Installation

1. Create `.obsidian/plugins/export-folder-to-zip/` inside your vault.
2. Copy `manifest.json`, `main.js`, and `styles.css` into it (already compiled or prepared in this repo).
3. Restart Obsidian → **Settings → Community plugins** → enable **Export Folder to ZIP**.
4. Go to **Settings → Export Folder to ZIP** → **"Buscar instalaciones locales"** (Windows) or add a binary manually. If no supported engine is installed, use **"Descargar 7-Zip"** to optionally install the binary for the current platform and architecture, then pick the active engine, format and level.

## Development

Requires [Node.js](https://nodejs.org/) 18+.

```bash
npm install        # dependencies
npm run build      # typecheck + production bundle → main.js
npm run dev        # watch mode
```

### Structure

```
manifest.json
versions.json
esbuild.config.mjs
tsconfig.json
src/
  main.ts            # entry: file-menu + job orchestration
  engines.ts         # fixed 7-Zip/WinRAR mapping + args + autodetect
  compress.ts        # spawn without shell + progress + cancel + move with suffix
  modal-progress.ts  # progress / cancel / background + status bar
  modal-save.ts      # save next to folder / download dialog
  modal-options.ts   # format, name, encryption and destination options
  download-7zip.ts   # optional pinned, hash-verified multi-platform binary download
  settings.ts        # PluginSettingTab
docs/
  documento_de_lineamientos_para_el_desarrollo_del_plugin_de_exportaci_n.md
```

## Release files and security

Each GitHub release must be tagged with the same version as `manifest.json` and include `main.js`, `manifest.json`, and `styles.css`. Run `npm run build` and `npm run validate:release` before creating a release. See [CHANGELOG.md](CHANGELOG.md) for release history and [SECURITY.md](SECURITY.md) for binary-download and reporting details.

## Out of scope

- Mobile use (desktop-only).
- Embedded engines (external binaries only).
- Extracting/decompressing archives.
- Scheduled automatic exports.

## License

MIT
