import { App, Notice, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import { ENGINES, detectInstalled, engineKindForBinary } from "./engines";
import { BinaryModal } from "./modal-binary";
import { Download7ZipModal } from "./download-7zip";
import { t } from "./i18n";
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
  custom7ZipUrl: string;
  custom7ZipSha256: string;
}

export const DEFAULT_SETTINGS: ExportSettings = {
  binaries: [],
  activeBinaryPath: "",
  formatId: "zip",
  levelId: "5",
  custom7ZipUrl: "",
  custom7ZipSha256: "",
};

export class ExportSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: ExportFolderPlugin) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const s = this.plugin.settings;
    const kind = engineKindForBinary(s.activeBinaryPath);

    const activeOptions: Record<string, string> = { "": t("settings.selectNone") };
    const formatOptions: Record<string, string> = {};
    const levelOptions: Record<string, string> = {};
    for (const b of s.binaries) {
      if (b.path) activeOptions[b.path] = b.name || b.path;
    }
    if (kind) {
      for (const f of ENGINES[kind].formats) formatOptions[f.id] = t(f.label);
      for (const l of ENGINES[kind].levels) levelOptions[l.id] = t(l.label);
    }

    const activeDesc = !s.activeBinaryPath
      ? t("settings.activeDesc")
      : kind
        ? t("settings.activeDesc")
        : t("settings.activeDescUnknown");

    return [
      {
        type: "list",
        heading: t("settings.enginesHeading"),
        emptyState: t("settings.empty"),
        addItem: {
          name: t("settings.addBinary"),
          action: () => this.editBinary(null),
        },
        onDelete: (index) => {
          void this.removeBinary(index);
        },
        items: s.binaries.map((entry) => ({
          name: entry.name || entry.path || t("settings.unnamedBinary"),
          searchable: false,
          action: (_el: HTMLElement, index: number) => this.editBinary(index),
        })),
      },
      {
        type: "group",
        heading: t("settings.installHeading"),
        items: [
          {
            name: t("settings.detectName"),
            desc: t("settings.detectDesc"),
            render: (setting) => {
              setting.addButton((button) => button
                .setButtonText(t("settings.detectButton"))
                .onClick(() => void this.detectBinaries()));
            },
          },
          {
            name: t("settings.downloadName"),
            desc: t("settings.downloadDesc"),
            render: (setting) => {
              setting.addButton((button) => button
                .setButtonText(t("settings.downloadButton"))
                .setCta()
                .onClick(() => new Download7ZipModal(this.plugin).open()));
            },
          },
          {
            name: t("settings.customUrlName"),
            desc: t("settings.customUrlDesc"),
            control: { type: "text", key: "custom7ZipUrl", placeholder: t("settings.customUrlPlaceholder") },
          },
          {
            name: t("settings.customHashName"),
            desc: t("settings.customHashDesc"),
            control: { type: "text", key: "custom7ZipSha256", placeholder: t("settings.customHashPlaceholder") },
          },
        ],
      },
      {
        type: "group",
        heading: t("settings.exportHeading"),
        items: [
          {
            name: t("settings.activeEngine"),
            desc: activeDesc,
            control: { type: "dropdown", key: "activeBinaryPath", options: activeOptions },
          },
          {
            name: t("settings.format"),
            desc: kind ? t("settings.formatDesc", { engine: ENGINES[kind].label }) : undefined,
            visible: kind !== null,
            control: { type: "dropdown", key: "formatId", options: formatOptions },
          },
          {
            name: t("settings.level"),
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
      case "custom7ZipUrl":
        s.custom7ZipUrl = String(value).trim();
        break;
      case "custom7ZipSha256":
        s.custom7ZipSha256 = String(value).trim().toLowerCase();
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
    if (found.length) {
      const activeStillExists = found.some((entry) => entry.path === s.activeBinaryPath) || s.binaries.some((entry) => entry.path === s.activeBinaryPath);
      if (!activeStillExists) s.activeBinaryPath = found[0].path;
      const activeKind = engineKindForBinary(s.activeBinaryPath);
      if (activeKind) {
        s.formatId = ENGINES[activeKind].formats[0].id;
        s.levelId = ENGINES[activeKind].levels.some((level) => level.id === "5") ? "5" : ENGINES[activeKind].levels[0].id;
      }
    }
    await this.plugin.saveSettings();
    this.update();
    if (found.length) new Notice(t("settings.detected", { count: found.length, name: s.binaries.find((entry) => entry.path === s.activeBinaryPath)?.name ?? s.activeBinaryPath }));
    else if (!added) new Notice(t("settings.notDetected"));
  }
}
