import { App, Modal, Notice, Setting } from "obsidian";
import type { BinaryEntry } from "./settings";

export class BinaryModal extends Modal {
  private nameValue: string;
  private pathValue: string;

  constructor(
    app: App,
    entry: BinaryEntry,
    private isNew: boolean,
    private onSave: (entry: BinaryEntry) => void
  ) {
    super(app);
    this.nameValue = entry.name;
    this.pathValue = entry.path;
  }

  onOpen() {
    this.titleEl.setText(this.isNew ? "Agregar binario" : "Editar binario");

    new Setting(this.contentEl)
      .setName("Nombre")
      .setDesc("Etiqueta para identificar el motor.")
      .addText((t) =>
        t.setValue(this.nameValue).setPlaceholder("7-Zip").onChange((v) => {
          this.nameValue = v;
        })
      );

    new Setting(this.contentEl)
      .setName("Ruta del ejecutable")
      .setDesc("Ruta completa de 7z.exe, WinRAR.exe o Rar.exe.")
      .addText((t) =>
        t.setValue(this.pathValue).setPlaceholder("C:\\Program Files\\7-Zip\\7z.exe").onChange((v) => {
          this.pathValue = v.trim();
        })
      );

    const buttons = new Setting(this.contentEl);
    buttons.addButton((b) =>
      b.setButtonText("Guardar").setCta().onClick(() => {
        if (!this.pathValue) {
          new Notice("Indicá la ruta del ejecutable.");
          return;
        }
        this.onSave({ name: this.nameValue.trim(), path: this.pathValue });
        this.close();
      })
    );
    buttons.addButton((b) =>
      b.setButtonText("Cancelar").onClick(() => {
        this.close();
      })
    );
  }

  onClose() {
    this.contentEl.empty();
  }
}
