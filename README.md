# Export Folder to ZIP — Obsidian plugin

Desktop **Obsidian** plugin that compresses vault folders using external system engines (**7-Zip** or **WinRAR**), with progress, cancel, background mode and flexible save options.

> Desktop-only: uses `child_process` to run the system binaries.

## Features

- **Context menu:** right-click a folder → **"Export folder to ZIP"**.
- **External engines:** 7-Zip (`zip`, `7z`, `tar`, `tar.gz`) or WinRAR (`rar`, `zip`), with compression levels tuned per engine.
- **Fixed exclusions:** `.obsidian/*` and `.git/*` never enter the archive.
- **Progress modal:** live percentage with **Cancel** (kills the process and cleans up the temp folder) and **Send to background** (status bar shows progress; click to reopen).
- **Flexible save:** on finish, **"Save next to the folder"** (same level, never inside; timestamp suffix if it already exists — never overwrites) or **"Download"** (native OS save dialog).
- **Settings:** add/edit/remove binaries, autodetect common installs (Program Files), active engine, format and level (adaptive per engine).

## Installation

1. Create `.obsidian/plugins/obsidian-export-folder-to-zip/` inside your vault.
2. Copy `manifest.json` and `main.js` into it (already compiled in this repo).
3. Restart Obsidian → **Settings → Community plugins** → enable **Export Folder to ZIP**.
4. Go to **Settings → Export Folder to ZIP** → **"Detect installed"** (or add the binary manually) and pick the active engine, format and level.

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
  settings.ts        # PluginSettingTab
docs/
  documento_de_lineamientos_para_el_desarrollo_del_plugin_de_exportaci_n.md
```

## Out of scope

- Mobile use (desktop-only).
- Embedded engines (external binaries only).
- Extracting/decompressing archives.
- Scheduled automatic exports.

## License

MIT
