import { FileSystemAdapter, Notice, Plugin, TFolder } from "obsidian";

type StatusBarItem = ReturnType<Plugin["addStatusBarItem"]>;
import { existsSync } from "fs";
import { dirname, join } from "path";
import { CompressionJob } from "./compress";
import { ENGINES, engineKindForBinary } from "./engines";
import { ProgressModal } from "./modal-progress";
import { SaveModal } from "./modal-save";
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

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.statusBar = this.addStatusBarItem();

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFolder)) return;
        menu.addItem((item) => {
          item.setTitle("Exportar carpeta a…");
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

  exportFolder(folder: TFolder) {
    if (this.job) {
      new Notice("Ya hay una exportación en curso.");
      return;
    }
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      new Notice("Este plugin requiere un vault local (Obsidian Desktop).");
      return;
    }

    const bin = this.settings.binaries.find((b) => b.path === this.settings.activeBinaryPath);
    if (!bin || !bin.path || !existsSync(bin.path)) {
      new Notice("Configurá un motor de compresión en Settings → Export Folder to ZIP.");
      (this.app as unknown as { setting: { open(): void; openTabById(id: string): void } }).setting.open();
      (this.app as unknown as { setting: { openTabById(id: string): void } }).setting.openTabById(this.manifest.id);
      return;
    }
    const kind = engineKindForBinary(bin.path);
    if (!kind) {
      new Notice("El binario activo no se reconoce como 7-Zip ni WinRAR.");
      return;
    }
    const spec = ENGINES[kind];
    const format = spec.formats.find((f) => f.id === this.settings.formatId) ?? spec.formats[0];
    const level = spec.levels.find((l) => l.id === this.settings.levelId) ?? spec.levels[0];

    const parts = folder.path.split("/");
    const relParent = parts.slice(0, -1).join("/");
    const parentDir = relParent ? join(adapter.getBasePath(), ...relParent.split("/")) : adapter.getBasePath();

    this.lastArchivePath = null;
    this.lastParentDir = parentDir;
    this.lastBaseName = folder.name;
    this.lastExt = format.ext;

    const job = new CompressionJob(bin.path, parentDir, folder.name, format.id, level.id, {
      onProgress: (pct) => this.onProgress(pct),
      onDone: (p) => this.onDone(p),
      onError: (m) => this.onError(m),
    });
    this.job = job;

    this.statusBar.setText(`📦 Comprimiendo ${folder.name}…`);
    this.statusBar.setAttr("title", "Export Folder to ZIP — click para ver el progreso");
    this.statusBar.onclick = () => this.reopenProgress();
    this.statusBar.show();

    new ProgressModal(this, folder.name).open();
    job.start();
  }

  private onProgress(pct: number | null) {
    const label = pct === null ? "…" : ` ${pct}%`;
    this.statusBar.setText(`📦 Comprimiendo ${this.job?.folderName ?? ""}${label}`);
    this.progressModal?.update(pct);
  }

  private onDone(archivePath: string) {
    this.lastArchivePath = archivePath;
    this.progressModal?.close();
    this.statusBar.setText("");
    this.statusBar.hide();
    new Notice(`Compresión de «${this.job?.folderName}» finalizada.`);
    new SaveModal(
      this,
      archivePath,
      this.job?.folderName ?? "",
      this.lastParentDir,
      this.lastBaseName,
      this.lastExt
    ).open();
  }

  private onError(message: string) {
    this.progressModal?.close();
    this.statusBar.setText("");
    this.statusBar.hide();
    this.job = null;
    new Notice(`Error al comprimir: ${message}`);
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
