import { FileSystemAdapter, Notice, Plugin, TFolder } from "obsidian";

type StatusBarItem = ReturnType<Plugin["addStatusBarItem"]>;
import { existsSync } from "fs";
import { join } from "path";
import { CompressionJob } from "./compress";
import { ENGINES, engineKindForBinary, executableForBinary, EngineKind } from "./engines";
import { ProgressModal } from "./modal-progress";
import { SaveModal } from "./modal-save";
import { OptionsModal } from "./modal-options";
import { t } from "./i18n";
import { DEFAULT_SETTINGS, ExportSettingTab, ExportSettings } from "./settings";

export default class ExportFolderPlugin extends Plugin {
  settings: ExportSettings;
  job: CompressionJob | null = null;
  progressModal: ProgressModal | null = null;
  private statusBar: StatusBarItem;
  private lastArchivePath: string | null = null;
  private lastParentDir = "";
  private lastBaseName = "";
  private lastExt = "";
  private lastDestination: "next-to-folder" | "download" = "download";

  async onload() {
    const data = (await this.loadData()) as Partial<ExportSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
    this.statusBar = this.addStatusBarItem();

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFolder)) return;
        menu.addItem((item) => {
          item.setTitle(t("menu.exportFolder"));
          item.setIcon("archive");
          item.onClick(() => this.exportFolder(file));
        });
      })
    );

    this.addSettingTab(new ExportSettingTab(this.app, this));
  }

  onunload() {
    this.cancelJob();
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  getPluginDirectory(): string {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) throw new Error(t("error.localVaultRequired"));
    return join(adapter.getBasePath(), this.app.vault.configDir, "plugins", this.manifest.id);
  }

  async registerDownloaded7Zip(binaryPath: string) {
    if (!existsSync(binaryPath)) throw new Error(t("error.downloadedMissing"));
    let binary = this.settings.binaries.find((entry) => entry.path === binaryPath);
    if (!binary) {
      binary = { name: t("engine.downloaded7zip"), path: binaryPath };
      this.settings.binaries.push(binary);
    }
    this.settings.activeBinaryPath = binaryPath;
    this.settings.formatId = "7z";
    this.settings.levelId = "5";
    await this.saveSettings();
    const settings = (this.app as unknown as { setting: { open(): void; openTabById(id: string): void } }).setting;
    settings.open();
    settings.openTabById(this.manifest.id);
  }

  exportFolder(folder: TFolder) {
    if (this.job) {
      new Notice(t("error.exportInProgress"));
      return;
    }
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      new Notice(t("error.localVaultRequired"));
      return;
    }

    const bin = this.settings.binaries.find((b) => b.path === this.settings.activeBinaryPath);
    if (!bin || !bin.path || !existsSync(bin.path)) {
      new Notice(t("error.binaryNotConfigured"));
      (this.app as unknown as { setting: { open(): void; openTabById(id: string): void } }).setting.open();
      (this.app as unknown as { setting: { openTabById(id: string): void } }).setting.openTabById(this.manifest.id);
      return;
    }
    const activeKind = engineKindForBinary(bin.path);
    if (!activeKind) {
      new Notice(t("error.unknownBinary"));
      return;
    }
    const available = [...this.settings.binaries]
      .sort((left, right) => Number(right.path === this.settings.activeBinaryPath) - Number(left.path === this.settings.activeBinaryPath))
      .filter((entry) => entry.path && existsSync(entry.path))
      .map((entry) => ({ entry, kind: engineKindForBinary(entry.path) }))
      .filter((item): item is { entry: typeof bin; kind: keyof typeof ENGINES } => item.kind !== null);
    const formats = new Map<string, { id: string; label: string; ext: string; kind: EngineKind }>();
    for (const item of available) {
      for (const format of ENGINES[item.kind].formats) {
        if (!formats.has(format.id)) formats.set(format.id, { ...format, label: t(format.label), kind: item.kind });
      }
    }
    const availableFormats = [...formats.values()];
    const levelsByKind = {
      "7zip": ENGINES["7zip"].levels.map((level) => ({ ...level, label: t(level.label) })),
      winrar: ENGINES.winrar.levels.map((level) => ({ ...level, label: t(level.label) })),
    };
    const preferredKind = formats.get(this.settings.formatId)?.kind ?? activeKind;
    const initialLevels = levelsByKind[preferredKind];
    const initialLevel = initialLevels.some((level) => level.id === this.settings.levelId)
      ? this.settings.levelId
      : initialLevels[0].id;
    new OptionsModal(this, folder.name, availableFormats, levelsByKind, this.settings.formatId, initialLevel, this.lastDestination, (options) => {
    this.lastDestination = options.destination;
    const selectedKind = formats.get(options.formatId)?.kind;
    const selectedEngine = selectedKind && available.find((item) => item.kind === selectedKind && ENGINES[item.kind].formats.some((format) => format.id === options.formatId));
    if (!selectedEngine) {
      new Notice(t("error.noEngineForFormat"));
      return;
    }
    this.settings.formatId = options.formatId;
    this.settings.levelId = options.levelId;
    void this.saveSettings();
    this.startExport(folder, selectedEngine.entry.path, options.formatId, options.extension, options.levelId, options.archiveName, options.password, options.destination);
    }).open();
  }

  private startExport(folder: TFolder, binaryPath: string, formatId: string, extension: string, levelId: string, archiveName: string, password: string | undefined, destination: "next-to-folder" | "download") {
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    const parts = folder.path.split("/");
    const relParent = parts.slice(0, -1).join("/");
    const parentDir = relParent ? join(adapter.getBasePath(), ...relParent.split("/")) : adapter.getBasePath();

    this.lastArchivePath = null;
    this.lastParentDir = parentDir;
    this.lastBaseName = archiveName.replace(new RegExp(`\\.${extension.replace(/\./g, "\\.")}$`, "i"), "");
    this.lastExt = extension;
    this.lastDestination = destination;

    const outputBaseName = this.lastBaseName;
    const job = new CompressionJob(
      executableForBinary(binaryPath),
      parentDir,
      folder.name,
      outputBaseName,
      formatId,
      levelId,
      this.app.vault.configDir,
      password,
      {
        onProgress: (pct) => this.onProgress(pct),
        onDone: (p) => this.onDone(p),
        onError: (m) => this.onError(m),
      }
    );
    this.job = job;

    this.statusBar.setText(t("status.compressing", { name: folder.name }));
    this.statusBar.setAttr("title", t("status.title"));
    this.statusBar.onclick = () => this.reopenProgress();
    this.statusBar.show();

    new ProgressModal(this, folder.name).open();
    try {
      job.start();
    } catch (error) {
      this.onError(error instanceof Error ? error.message : String(error));
    }
  }

  private onProgress(pct: number | null) {
    const label = pct === null ? "…" : ` ${pct}%`;
    this.statusBar.setText(t("status.compressing", { name: `${this.job?.folderName ?? ""}${label}` }));
    this.progressModal?.update(pct);
  }

  private onDone(archivePath: string) {
    this.lastArchivePath = archivePath;
    const completedFolderName = this.job?.folderName ?? "";
    this.progressModal?.close();
    this.statusBar.setText("");
    this.statusBar.hide();
    this.job = null;
    new Notice(t("notice.compressionDone", { name: completedFolderName }));
    new SaveModal(
      this,
      archivePath,
      completedFolderName,
      this.lastParentDir,
      this.lastBaseName,
      this.lastExt,
      this.lastDestination,
      `${this.lastBaseName}.${this.lastExt}`
    ).open();
  }

  private onError(message: string) {
    this.progressModal?.close();
    this.statusBar.setText("");
    this.statusBar.hide();
    this.job = null;
    new Notice(t("error.compressionFailed", { message }));
  }

  cancelJob() {
    this.job?.cancel();
    this.job = null;
    this.statusBar.setText("");
    this.statusBar.hide();
  }

  /** Limpia el job y el temporal (y la barra de estado). Con removeArchive=false se deja el temporal intacto. */
  finalizeJob(removeArchive = true) {
    if (removeArchive) this.job?.cleanup();
    this.job = null;
    this.lastArchivePath = null;
    this.statusBar.setText("");
    this.statusBar.hide();
  }

  private reopenProgress() {
    if (!this.job) return;
    if (!this.progressModal) new ProgressModal(this, this.job.folderName).open();
  }
}
