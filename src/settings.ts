import { App, Notice, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import { ENGINES, detectInstalled, engineKindForBinary } from "./engines";
import { BinaryModal } from "./modal-binary";
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

  getSettingDefinitions(): SettingDefinitionItem[] {
    const s = this.plugin.settings;
    const kind = engineKindForBinary(s.activeBinaryPath);

    const activeOptions: Record<string, string> = { "": "— seleccionar —" };
    const formatOptions: Record<string, string> = {};
    const levelOptions: Record<string, string> = {};
    for (const b of s.binaries) {
      if (b.path) activeOptions[b.path] = b.name || b.path;
    }
    if (kind) {
      for (const f of ENGINES[kind].formats) formatOptions[f.id] = f.label;
      for (const l of ENGINES[kind].levels) levelOptions[l.id] = l.label;
    }

    const activeDesc = !s.activeBinaryPath
      ? "Binario que se usa por defecto para comprimir."
      : kind
        ? "Binario que se usa por defecto para comprimir."
        : "El binario activo no se reconoce como 7-Zip ni WinRAR.";

    return [
      {
        type: "list",
        heading: "Motores de compresión",
        emptyState: "Sin binarios configurados.",
        addItem: {
          name: "Agregar binario",
          action: () => this.editBinary(null),
        },
        extraButtons: [
          (b) =>
            b.setIcon("lucide-search").setTooltip("Detectar instalados").onClick(() => {
              void this.detectBinaries();
            }),
        ],
        onDelete: (index) => {
          void this.removeBinary(index);
        },
        items: s.binaries.map((entry) => ({
          name: entry.name || entry.path || "Binario sin nombre",
          searchable: false,
          action: (_el: HTMLElement, index: number) => this.editBinary(index),
        })),
      },
      {
        type: "group",
        heading: "Preferencias de exportación",
        items: [
          {
            name: "Motor activo",
            desc: activeDesc,
            control: { type: "dropdown", key: "activeBinaryPath", options: activeOptions },
          },
          {
            name: "Formato de salida",
            desc: kind ? `Formatos soportados por ${ENGINES[kind].label}.` : undefined,
            visible: kind !== null,
            control: { type: "dropdown", key: "formatId", options: formatOptions },
          },
          {
            name: "Nivel de compresión",
            visible: kind !== null,
            control: { type: "dropdown", key: "levelId", options: levelOptions },
          },
        ],
      },
    ];
  }

  override async setControlValue(key: string, value: unknown): Promise<void> {
    const s = this.plugin.settings;
    switch (key) {
      case "activeBinaryPath": {
        const path = String(value);
        s.activeBinaryPath = path;
        const kind = engineKindForBinary(path);
        if (kind) {
          s.formatId = ENGINES[kind].formats[0].id;
          s.levelId = ENGINES[kind].levels.some((l) => l.id === "5")
            ? "5"
            : ENGINES[kind].levels[0].id;
        }
        break;
      }
      case "formatId":
        s.formatId = String(value);
        break;
      case "levelId":
        s.levelId = String(value);
        break;
      default:
        return;
    }
    await this.plugin.saveSettings();
    this.update();
  }

  private editBinary(index: number | null): void {
    const isNew = index === null;
    const current = isNew
      ? { name: "", path: "" }
      : { ...this.plugin.settings.binaries[index] };
    new BinaryModal(this.app, current, isNew, async (value) => {
      const s = this.plugin.settings;
      if (index === null) {
        s.binaries.push(value);
      } else {
        const previous = s.binaries[index];
        if (s.activeBinaryPath === previous.path) s.activeBinaryPath = value.path;
        s.binaries[index] = value;
      }
      await this.plugin.saveSettings();
      this.update();
    }).open();
  }

  private async removeBinary(index: number): Promise<void> {
    const [removed] = this.plugin.settings.binaries.splice(index, 1);
    if (removed && this.plugin.settings.activeBinaryPath === removed.path) {
      this.plugin.settings.activeBinaryPath = "";
    }
    await this.plugin.saveSettings();
    this.update();
  }

  private async detectBinaries(): Promise<void> {
    const s = this.plugin.settings;
    const found = detectInstalled();
    let added = 0;
    for (const f of found) {
      if (!s.binaries.some((x) => x.path === f.path)) {
        s.binaries.push(f);
        added++;
      }
    }
    if (!s.activeBinaryPath && s.binaries.length) {
      s.activeBinaryPath = s.binaries[0].path;
    }
    await this.plugin.saveSettings();
    this.update();
    if (!added) new Notice("No se detectaron binarios nuevos.");
  }
}
