import { Modal, Setting } from "obsidian";
import type ExportFolderPlugin from "./main";

export class ProgressModal extends Modal {
  private pctEl: HTMLElement;
  private fillEl: HTMLElement;

  constructor(private plugin: ExportFolderPlugin, private folderName: string) {
    super(plugin.app);
    this.plugin.progressModal = this;
  }

  onOpen() {
    this.titleEl.setText("Exportando carpeta");
    this.contentEl.createEl("p", { text: `Comprimiendo «${this.folderName}»…` });

    const bar = this.contentEl.createDiv();
    bar.style.height = "8px";
    bar.style.borderRadius = "4px";
    bar.style.background = "var(--background-modifier-border)";
    bar.style.overflow = "hidden";
    bar.style.marginBottom = "8px";
    this.fillEl = bar.createDiv();
    this.fillEl.style.height = "100%";
    this.fillEl.style.width = "0%";
    this.fillEl.style.background = "var(--interactive-accent)";
    this.fillEl.style.transition = "width 0.2s";

    this.pctEl = this.contentEl.createEl("p", { text: "Iniciando…" });

    const buttons = new Setting(this.contentEl);
    buttons.addButton((b) =>
      b.setButtonText("Cancelar").setWarning().onClick(() => {
        this.plugin.cancelJob();
        this.close();
      })
    );
    buttons.addButton((b) =>
      b.setButtonText("Enviar a segundo plano").onClick(() => {
        this.close();
      })
    );
  }

  update(percent: number | null) {
    if (percent === null) {
      this.pctEl.setText("Comprimiendo…");
      return;
    }
    this.pctEl.setText(`${percent}%`);
    this.fillEl.style.width = `${percent}%`;
  }

  onClose() {
    if (this.plugin.progressModal === this) this.plugin.progressModal = null;
    this.contentEl.empty();
  }
}
