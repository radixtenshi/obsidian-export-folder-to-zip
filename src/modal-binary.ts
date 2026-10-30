import { App, Modal, Notice, Setting } from "obsidian";
import { t } from "./i18n";
import type { BinaryEntry } from "./settings";

export class BinaryModal extends Modal {
  private nameValue: string;
  private pathValue: string;

  constructor(
    app: App,
    entry: BinaryEntry,
    private isNew: boolean,
    private onSave: (entry: BinaryEntry) => void | Promise<void>
  ) {
    super(app);
    this.nameValue = entry.name;
    this.pathValue = entry.path;
  }

  onOpen() {
    this.titleEl.setText(t(this.isNew ? "binary.addTitle" : "binary.editTitle"));

    new Setting(this.contentEl)
      .setName(t("binary.name"))
      .setDesc(t("binary.nameDesc"))
      .addText((text) =>
        text.setValue(this.nameValue).setPlaceholder("7-Zip").onChange((v) => {
          this.nameValue = v;
        })
      );

    new Setting(this.contentEl)
      .setName(t("binary.path"))
      .setDesc(t("binary.pathDesc"))
      .addText((text) =>
        text.setValue(this.pathValue).setPlaceholder("C:\\Program Files\\7-Zip\\7z.exe").onChange((v) => {
          this.pathValue = v.trim();
        })
      );

    const buttons = new Setting(this.contentEl);
    buttons.addButton((b) =>
      b.setButtonText(t("action.save")).setCta().onClick(() => {
        if (!this.pathValue) {
          new Notice(t("binary.pathRequired"));
          return;
        }
        this.onSave({ name: this.nameValue.trim(), path: this.pathValue });
        this.close();
      })
    );
    buttons.addButton((b) =>
      b.setButtonText(t("action.cancel")).onClick(() => {
        this.close();
      })
    );
  }

  onClose() {
    this.contentEl.empty();
  }
}
