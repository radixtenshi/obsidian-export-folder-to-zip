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
    bar.setCssProps({
      height: "8px",
      "border-radius": "4px",
      background: "var(--background-modifier-border)",
      overflow: "hidden",
      "margin-bottom": "8px",
    });
    this.fillEl = bar.createDiv();
    this.fillEl.setCssProps({
      height: "100%",
      width: "0%",
      background: "var(--interactive-accent)",
      transition: "width 0.2s",
    });

    this.pctEl = this.contentEl.createEl("p", { text: "Iniciando…" });

    const buttons = new Setting(this.contentEl);
    buttons.addButton((b) =>
      b.setButtonText("Cancelar").setDestructive().onClick(() => {
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
    this.fillEl.setCssProps({ width: `${percent}%` });
  }

  onClose() {
    if (this.plugin.progressModal === this) this.plugin.progressModal = null;
    this.contentEl.empty();
  }
}
