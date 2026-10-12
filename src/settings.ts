import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { ENGINES, detectInstalled, engineKindForBinary } from "./engines";
import type ExportFolderPlugin from "./main";

export interface BinaryEntry {
  name: string;
  path: string;
}

export interface ExportSettings {
  binaries: BinaryEntry[];
  activeBinaryPath: string;
  formatId: string;
  levelId: string;
}

export const DEFAULT_SETTINGS: ExportSettings = {
  binaries: [],
  activeBinaryPath: "",
  formatId: "zip",
  levelId: "5",
};

export class ExportSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: ExportFolderPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h3", { text: "Motores de compresión" });

    for (let i = 0; i < this.plugin.settings.binaries.length; i++) {
      const entry = this.plugin.settings.binaries[i];
      new Setting(containerEl)
        .addText((t) =>
          t.setPlaceholder("Nombre").setValue(entry.name).onChange(async (v) => {
            entry.name = v;
            await this.plugin.saveSettings();
          })
        )
        .addText((t) =>
          t.setPlaceholder("Ruta del ejecutable").setValue(entry.path).onChange(async (v) => {
            entry.path = v.trim();
            await this.plugin.saveSettings();
          })
        )
        .addButton((b) =>
          b.setButtonText("Quitar").setWarning().onClick(async () => {
            this.plugin.settings.binaries.splice(i, 1);
            if (this.plugin.settings.activeBinaryPath === entry.path) {
              this.plugin.settings.activeBinaryPath = "";
            }
            await this.plugin.saveSettings();
            this.display();
          })
        );
    }

    new Setting(containerEl)
      .addButton((b) =>
        b.setButtonText("Agregar binario").onClick(async () => {
          this.plugin.settings.binaries.push({ name: "", path: "" });
          await this.plugin.saveSettings();
          this.display();
        })
      )
      .addButton((b) =>
        b.setButtonText("Detectar instalados").onClick(async () => {
          const found = detectInstalled();
          let added = 0;
          for (const f of found) {
            if (!this.plugin.settings.binaries.some((x) => x.path === f.path)) {
              this.plugin.settings.binaries.push(f);
              added++;
            }
          }
          if (!this.plugin.settings.activeBinaryPath && this.plugin.settings.binaries.length) {
            this.plugin.settings.activeBinaryPath = this.plugin.settings.binaries[0].path;
          }
          await this.plugin.saveSettings();
          this.display();
          if (!added) new Notice("No se detectaron binarios nuevos.");
        })
      );

    containerEl.createEl("h3", { text: "Preferencias de exportación" });

    new Setting(containerEl)
      .setName("Motor activo")
      .setDesc("Binario que se usa por defecto para comprimir.")
      .addDropdown((d) => {
        d.addOption("", "— seleccionar —");
        for (const b of this.plugin.settings.binaries) {
          if (b.path) d.addOption(b.path, `${b.name || b.path}`);
        }
        d.setValue(this.plugin.settings.activeBinaryPath).onChange(async (v) => {
          this.plugin.settings.activeBinaryPath = v;
          const kind = engineKindForBinary(v);
          if (kind) {
            this.plugin.settings.formatId = ENGINES[kind].formats[0].id;
            this.plugin.settings.levelId = ENGINES[kind].levels.some((l) => l.id === "5")
              ? "5"
              : ENGINES[kind].levels[0].id;
          }
          await this.plugin.saveSettings();
          this.display();
        });
      });

    const kind = engineKindForBinary(this.plugin.settings.activeBinaryPath);
    if (kind) {
      const spec = ENGINES[kind];
      new Setting(containerEl)
        .setName("Formato de salida")
        .setDesc(`Formatos soportados por ${spec.label}.`)
        .addDropdown((d) => {
          for (const f of spec.formats) d.addOption(f.id, f.label);
          d.setValue(spec.formats.some((f) => f.id === this.plugin.settings.formatId) ? this.plugin.settings.formatId : spec.formats[0].id)
            .onChange(async (v) => {
              this.plugin.settings.formatId = v;
              await this.plugin.saveSettings();
            });
        });

      new Setting(containerEl)
        .setName("Nivel de compresión")
        .addDropdown((d) => {
          for (const l of spec.levels) d.addOption(l.id, l.label);
          d.setValue(spec.levels.some((l) => l.id === this.plugin.settings.levelId) ? this.plugin.settings.levelId : spec.levels[0].id)
            .onChange(async (v) => {
              this.plugin.settings.levelId = v;
              await this.plugin.saveSettings();
            });
        });
    } else if (this.plugin.settings.activeBinaryPath) {
      containerEl.createEl("p", {
        text: "El binario activo no se reconoce como 7-Zip ni WinRAR.",
      });
    }
  }
}
