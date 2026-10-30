import { Modal, Notice } from "obsidian";
import { existsSync, statSync } from "fs";
import { join } from "path";
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
    private ext: string,
    private destination: "next-to-folder" | "download",
    private archiveName: string
  ) {
    super(plugin.app);
  }

  onOpen() {
    const fileName = this.archiveName;
    let sizeLabel = "";
    try {
      sizeLabel = ` — ${formatBytes(statSync(this.archivePath).size)}`;
    } catch {
      // sin tamaño si el archivo ya no está
    }
    this.titleEl.setText("Compresión finalizada");
    this.contentEl.createEl("p", { text: `«${fileName}»${sizeLabel}` });

    if (this.destination === "next-to-folder") this.saveNextTo();
    else void this.download();
  }

  private saveNextTo() {
    const dest = uniqueTargetPath(this.parentDir, this.archiveName.replace(new RegExp(`\\.${this.ext.replace(/\./g, "\\.")}$`, "i"), ""), this.ext);
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
    if (savePath === undefined) {
      this.close(); // onClose elimina el temporal
      return;
    }

    this.plugin.finalizeJob();
    new Notice("No hay diálogo de guardado disponible; se eliminó el archivo temporal.");
    this.close();
  }

  /** Devuelve la ruta elegida; null si no hay diálogo; undefined si se canceló. */
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
        defaultPath: join(this.parentDir, this.archiveName),
        filters: [{ name: this.ext, extensions: [this.ext] }],
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
