import { Modal, Setting } from "obsidian";
import { t } from "./i18n";
import type ExportFolderPlugin from "./main";

export class ProgressModal extends Modal {
  private pctEl: HTMLElement;
  private fillEl: HTMLElement;

  constructor(private plugin: ExportFolderPlugin, private folderName: string) {
    super(plugin.app);
    this.plugin.progressModal = this;
  }

  onOpen() {
    this.titleEl.setText(t("progress.title"));
    this.contentEl.createEl("p", { text: t("progress.compressing", { name: this.folderName }) });

    const bar = this.contentEl.createDiv({ cls: "ofz-progress-track" });
    this.fillEl = bar.createDiv({ cls: "ofz-progress-fill" });

    this.pctEl = this.contentEl.createEl("p", { text: t("progress.starting") });

    const buttons = new Setting(this.contentEl);
    buttons.addButton((b) =>
      b.setButtonText(t("action.cancel")).setDestructive().onClick(() => {
        this.plugin.cancelJob();
        this.close();
      })
    );
    buttons.addButton((b) =>
      b.setButtonText(t("progress.background")).onClick(() => {
        this.close();
      })
    );
  }

  update(percent: number | null) {
    if (percent === null) {
      this.pctEl.setText(t("progress.engineStarted"));
      return;
    }
    this.pctEl.setText(`${percent}%`);
    this.fillEl.setCssProps({ width: `${percent}%` });
  }

  onClose() {
    if (this.plugin.progressModal === this) this.plugin.progressModal = null;
    this.contentEl.empty();
  }
}
