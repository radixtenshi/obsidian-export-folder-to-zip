import { Modal, Notice, Setting } from "obsidian";
import { existsSync, statSync } from "fs";
import { basename, join } from "path";
import { formatBytes, moveArchive, uniqueTargetPath } from "./compress";
import type ExportFolderPlugin from "./main";

export class SaveModal extends Modal {
  private done = false;

  constructor(
    private plugin: ExportFolderPlugin,
    private archivePath: string,
    private folderName: string,
    private parentDir: string,
    private baseName: string,
    private ext: string
  ) {
    super(plugin.app);
  }

  onOpen() {
    const fileName = basename(this.archivePath);
    let sizeLabel = "";
    try {
      sizeLabel = ` — ${formatBytes(statSync(this.archivePath).size)}`;
    } catch {
      // sin tamaño si el archivo ya no está
    }
    this.titleEl.setText("Compresión finalizada");
    this.contentEl.createEl("p", { text: `«${fileName}»${sizeLabel}` });

    const buttons = new Setting(this.contentEl);
    buttons.addButton((b) =>
      b.setButtonText("Guardar junto a la carpeta").onClick(() => this.saveNextTo())
    );
    buttons.addButton((b) =>
      b.setButtonText("Descargar").setCta().onClick(() => void this.download())
    );
  }

  private saveNextTo() {
    const dest = uniqueTargetPath(this.parentDir, this.baseName, this.ext);
    try {
      moveArchive(this.archivePath, dest);
      this.done = true;
      new Notice(`Guardado en: ${dest}`);
    } catch (e) {
      new Notice(`No se pudo guardar: ${e instanceof Error ? e.message : e}`);
      return;
    }
    this.plugin.finalizeJob();
    this.close();
  }

  private async download() {
    const savePath = await this.showNativeDialog();
    if (savePath) {
      try {
        moveArchive(this.archivePath, savePath);
        this.done = true;
        new Notice(`Guardado en: ${savePath}`);
        this.plugin.finalizeJob();
      } catch (e) {
        new Notice(`No se pudo guardar: ${e instanceof Error ? e.message : e}`);
      }
      this.close();
      return;
    }
    if (savePath === null) return; // diálogo cancelado por el usuario

    // fallback: abrir la carpeta temporal en el explorador
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- electron no se puede empaquetar; se resuelve en runtime
      const { shell } = require("electron") as { shell: { showItemInFolder(p: string): void } };
      shell.showItemInFolder(this.archivePath);
      new Notice(`Archivo temporal en: ${this.archivePath}`);
      this.done = true; // el usuario decide: no borrar
      this.plugin.finalizeJob(false);
    } catch {
      new Notice(`No se pudo abrir el explorador. Archivo en: ${this.archivePath}`);
    }
    this.close();
  }

  /** Devuelve la ruta elegida, null si el SO no ofreció diálogo (fallback), o undefined si el usuario canceló. */
  private async showNativeDialog(): Promise<string | null | undefined> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- electron no se puede empaquetar; se resuelve en runtime
      const electron = require("electron") as {
        remote?: { dialog?: DialogLike };
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- @electron/remote es opcional; se intenta cargar en runtime
      const remoteMod = (() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- @electron/remote es opcional; se intenta cargar en runtime
          return require("@electron/remote") as { dialog?: DialogLike };
        } catch {
          return undefined;
        }
      })();
      const dialog = electron.remote?.dialog ?? remoteMod?.dialog;
      if (!dialog?.showSaveDialog) return null;
      const res = await dialog.showSaveDialog({
        defaultPath: join(this.parentDir, `${this.baseName}.${this.ext}`),
        filters: [{ name: this.ext, extensions: this.ext.split(".") }],
      });
      if (res.canceled || !res.filePath) return undefined;
      return res.filePath;
    } catch {
      return null;
    }
  }

  onClose() {
    if (!this.done && existsSync(this.archivePath)) {
      this.plugin.finalizeJob(); // limpia el temporal
    }
    this.contentEl.empty();
  }
}

interface DialogLike {
  showSaveDialog(options: {
    defaultPath: string;
    filters: { name: string; extensions: string[] }[];
  }): Promise<{ canceled: boolean; filePath?: string }>;
}
