import { Modal, Notice, Setting } from "obsidian";
import type ExportFolderPlugin from "./main";

export interface ExportOptions {
  folderName: string;
  formatId: string;
  extension: string;
  levelId: string;
  archiveName: string;
  password?: string;
  destination: "next-to-folder" | "download";
}

interface FormatOption {
  id: string;
  label: string;
  ext: string;
  kind: "7zip" | "winrar";
}

interface LevelOption {
  id: string;
  label: string;
}

export class OptionsModal extends Modal {
  private customName = false;
  private encrypt = false;
  private archiveName = "";
  private password = "";
  private formatId: string;
  private levelId: string;
  private destination: "next-to-folder" | "download";

  constructor(
    private plugin: ExportFolderPlugin,
    private folderName: string,
    private formats: FormatOption[],
    private levelsByKind: Record<"7zip" | "winrar", LevelOption[]>,
    initialFormatId: string,
    initialLevelId: string,
    initialDestination: "next-to-folder" | "download",
    private onConfirm: (options: ExportOptions) => void
  ) {
    super(plugin.app);
    this.formatId = initialFormatId;
    this.levelId = initialLevelId;
    this.destination = initialDestination;
  }

  onOpen() {
    this.draw();
  }

  private draw() {
    const format = this.formats.find((item) => item.id === this.formatId) ?? this.formats[0];
    if (!format) return;
    const encryptedFormats = this.canEncrypt(format);
    const levels = this.levelsByKind[format.kind];
    this.levelId = this.selectedLevelId(format);

    this.titleEl.setText("Exportar carpeta");
    this.contentEl.createEl("p", { text: `Configurá la exportación de «${this.folderName}». No se creará ningún archivo hasta confirmar.` });
    new Setting(this.contentEl).setName("Formato de salida").addDropdown((dropdown) => {
      for (const item of this.formats) dropdown.addOption(item.id, item.label);
      dropdown.setValue(format.id).onChange((value) => {
        this.formatId = value;
        this.archiveName = "";
        const newFormat = this.formats.find((item) => item.id === value);
        if (newFormat) {
          this.levelId = this.selectedLevelId(newFormat);
          if (!this.canEncrypt(newFormat)) this.encrypt = false;
        }
        this.render();
      });
    });
    new Setting(this.contentEl).setName("Nivel de compresión").addDropdown((dropdown) => {
      for (const item of levels) dropdown.addOption(item.id, item.label);
      dropdown.setValue(this.levelId).onChange((value) => { this.levelId = value; });
    });
    new Setting(this.contentEl).setName("Definir nombre del archivo").addToggle((toggle) => toggle
      .setValue(this.customName)
      .onChange((value) => {
        this.customName = value;
        if (value && !this.archiveName) this.archiveName = `${this.folderName}.${format.ext}`;
        this.render();
      }));
    if (this.customName) new Setting(this.contentEl)
      .setName("Nombre del archivo")
      .setDesc(`Podés escribirlo con o sin extensión; se usará .${format.ext}.`)
      .addText((text) => text
        .setValue(this.archiveName || `${this.folderName}.${format.ext}`)
        .setPlaceholder(`${this.folderName}.${format.ext}`)
        .onChange((value) => { this.archiveName = value; }));

    const encryption = new Setting(this.contentEl).setName("Cifrar archivo");
    if (!encryptedFormats) encryption.setDesc("El formato seleccionado no admite cifrado.");
    encryption.addToggle((toggle) => toggle
      .setDisabled(!encryptedFormats)
      .setValue(this.encrypt && encryptedFormats)
      .onChange((value) => { this.encrypt = value; this.render(); }));
    if (this.encrypt && encryptedFormats) {
      const passwordSetting = new Setting(this.contentEl).setName("Contraseña");
      const passwordInput = passwordSetting.controlEl.createEl("input", { type: "password", placeholder: "Ingresá una contraseña" });
      passwordInput.value = this.password;
      passwordInput.addEventListener("input", () => { this.password = passwordInput.value; });
    }

    new Setting(this.contentEl).setName("Destino").addDropdown((dropdown) => dropdown
      .addOption("next-to-folder", "Guardar junto a la carpeta")
      .addOption("download", "Descargar (elegir ubicación)")
      .setValue(this.destination)
      .onChange((value) => { this.destination = value as "next-to-folder" | "download"; }));
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText("Cancelar").onClick(() => this.close()))
      .addButton((button) => button.setButtonText("Comprimir").setCta().onClick(() => this.confirm()));
  }

  private canEncrypt(format: FormatOption): boolean {
    return format.kind === "7zip"
      ? format.id === "7z" || format.id === "zip"
      : format.id === "rar" || format.id === "zip";
  }

  private selectedLevelId(format: FormatOption): string {
    const levels = this.levelsByKind[format.kind];
    return levels.some((level) => level.id === this.levelId) ? this.levelId : levels[0]?.id ?? "5";
  }

  private render() {
    this.contentEl.empty();
    this.draw();
  }

  private confirm() {
    const format = this.formats.find((item) => item.id === this.formatId) ?? this.formats[0];
    if (!format) return;
    const encryptedFormats = this.canEncrypt(format);
    if (this.encrypt && encryptedFormats && !this.password) {
      new Notice("Ingresá una contraseña para cifrar el archivo.");
      return;
    }
    let rawName = this.customName ? this.archiveName.trim() : `${this.folderName}.${format.ext}`;
    const selectedExtension = `.${format.ext}`;
    if (rawName.toLowerCase().endsWith(selectedExtension.toLowerCase())) rawName = rawName.slice(0, -selectedExtension.length);
    const safeName = rawName.replace(/[\\/:*?"<>|]/g, "_").replace(/\.+$/, "");
    if (!safeName || safeName === "." || safeName === "..") {
      new Notice("Ingresá un nombre de archivo válido.");
      return;
    }
    const archiveName = `${safeName}.${format.ext}`;
    const options: ExportOptions = {
      folderName: this.folderName,
      formatId: format.id,
      extension: format.ext,
      levelId: this.levelId,
      archiveName,
      password: this.encrypt && encryptedFormats ? this.password : undefined,
      destination: this.destination,
    };
    this.close();
    this.onConfirm(options);
  }
}
