import { chmodSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { get } from "https";
import { dirname, join } from "path";
import { Modal, Notice, Setting } from "obsidian";
import { t } from "./i18n";
import type ExportFolderPlugin from "./main";

const PINNED_COMMIT = "234abf56ddc2935de44e07d5e3c40eecab95d5af";
const REPOSITORY_URL = "https://github.com/develar/7zip-bin";
const MAX_CUSTOM_BINARY_SIZE = 100 * 1024 * 1024;
const BINARIES: Record<string, { size: number; sha256: string }> = {
  "win32/arm64": { size: 1089024, sha256: "81f67048b7366870e5d49f00a8c570570c6a0dd11c05df7a09a8c52870cc83bd" },
  "win32/ia32": { size: 792064, sha256: "31fd52f8996986623cf52c3b4d0f7ac74a9dec63fc16c902cef673eed550c435" },
  "win32/x64": { size: 1231360, sha256: "b0cfdeaf429f5cc53f85123dd8f5a5feb92c19d31aa34df257edf9a26be05f95" },
  "darwin/arm64": { size: 988208, sha256: "6f4dd78a82cf574f49118d99be620fd3edcfa9e48971d8523816b7ed20419c47" },
  "darwin/x64": { size: 2941888, sha256: "434075f6ff5ea9250571033ca06b95d464efcad87a528dd0b224816c86b1a444" },
  "linux/arm": { size: 1006780, sha256: "3a68d5c794bb8534040f3f93480a7fe8194bf5ed8e0d3e2ac0de4dea9677a64c" },
  "linux/arm64": { size: 1155640, sha256: "d363b0055afb4f7f336152dd5d00f1cc992d6e86a56e4a1ec84b2ac26dee27ff" },
  "linux/ia32": { size: 1638192, sha256: "8400fe1f78c7033ddf16f55b82c3a520a91c424a29d5163c45c6e085c5834373" },
  "linux/x64": { size: 1457384, sha256: "afc9448bd0cc2eeda131cce313ef4994f9656417e0a15c8465fcda9ca859b280" },
};

export class Download7ZipModal extends Modal {
  private downloading = false;

  constructor(private plugin: ExportFolderPlugin) {
    super(plugin.app);
  }

  onOpen() {
    this.titleEl.setText(t("download.title"));
    const platformKey = `${process.platform}/${process.arch}`;
    const customUrl = this.plugin.settings.custom7ZipUrl.trim();
    const customHash = this.plugin.settings.custom7ZipSha256.trim().toLowerCase();
    const customConfigured = Boolean(customUrl || customHash);
    const customValid = !customConfigured || (isHttpsUrl(customUrl) && /^[a-f0-9]{64}$/.test(customHash));
    const supported = customConfigured ? customValid : Boolean(BINARIES[platformKey]);
    this.contentEl.createEl("p", { text: t("download.system", { platform: process.platform, arch: process.arch }) });
    const source = customConfigured && customValid ? customUrl : REPOSITORY_URL;
    this.contentEl.createEl("p", { text: t("download.sourceLabel") });
    const sourceLink = this.contentEl.createEl("a", { text: source, href: source });
    sourceLink.setAttr("target", "_blank");
    sourceLink.setAttr("rel", "noopener noreferrer");
    if (!customConfigured) this.contentEl.createEl("p", { text: t("download.pinnedRevision", { commit: PINNED_COMMIT }) });
    this.contentEl.createEl("p", { text: t("download.warning") });
    const buttons = new Setting(this.contentEl);
    buttons.addButton((button) => button.setButtonText(t("action.cancel")).onClick(() => this.close()));
    buttons.addButton((button) => button.setButtonText(t("download.accept")).setCta().setDisabled(!supported).onClick(() => void this.download()));
    if (!supported) this.contentEl.createEl("p", { text: t(customConfigured ? "download.invalidCustom" : "download.unsupported") });
  }

  private async download() {
    if (this.downloading) return;
    const platformKey = `${process.platform}/${process.arch}`;
    const customUrl = this.plugin.settings.custom7ZipUrl.trim();
    const customHash = this.plugin.settings.custom7ZipSha256.trim().toLowerCase();
    const customConfigured = Boolean(customUrl || customHash);
    const binaryInfo = BINARIES[platformKey];
    if (customConfigured && (!isHttpsUrl(customUrl) || !/^[a-f0-9]{64}$/.test(customHash))) {
      new Notice(t("download.errorCustomUrl"));
      return;
    }
    if (!customConfigured && !binaryInfo) {
      new Notice(t("download.errorUnsupported"));
      return;
    }
    this.downloading = true;
    this.contentEl.empty();
    this.titleEl.setText(t("download.titleProgress"));
    const status = this.contentEl.createEl("p", { text: t("download.connecting") });
    try {
      const fileName = process.platform === "win32" ? "7za.exe" : "7za";
      const target = join(this.plugin.getPluginDirectory(), "bin", process.platform, process.arch, fileName);
      const sourceUrl = customConfigured ? customUrl : getPinnedUrl(platformKey);
      const expected = customConfigured ? { sha256: customHash, size: undefined } : binaryInfo;
      await downloadAndVerifyBinary(sourceUrl, target, expected, (received, total) => {
        status.setText(total ? t("download.progressPercent", { percent: Math.floor(received / total * 100) }) : t("download.progressKb", { kb: Math.round(received / 1024) }));
      });
      await this.plugin.registerDownloaded7Zip(target);
      new Notice(t("download.installed"));
      this.close();
    } catch (error) {
      new Notice(t("download.failed", { message: error instanceof Error ? error.message : String(error) }));
      this.downloading = false;
      this.close();
    }
  }
}

function downloadAndVerifyBinary(url: string, target: string, expected: { size?: number; sha256: string }, onProgress: (received: number, total: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const temporary = `${target}.download`;
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      try { if (existsSync(temporary)) rmSync(temporary, { force: true }); } catch { /* best-effort cleanup */ }
      reject(error);
    };
    try {
      mkdirSync(dirname(target), { recursive: true });
      if (existsSync(temporary)) rmSync(temporary, { force: true });
    } catch (error) {
      reject(error);
      return;
    }

    const requestUrl = (requestUrlValue: string, redirects: number) => {
      const request = get(requestUrlValue, { headers: { "User-Agent": "Obsidian-Export-Folder-to-ZIP" } }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
        const location = response.headers.location;
        response.resume();
        if (!location || redirects >= 5) {
          fail(new Error(t("download.errorRedirects")));
          return;
        }
        const redirected = new URL(location, requestUrlValue);
        if (redirected.protocol !== "https:") {
          fail(new Error(t("download.errorRedirectHttps")));
          return;
        }
        requestUrl(redirected.toString(), redirects + 1);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        fail(new Error(t("download.errorHttp", { status: response.statusCode ?? "?" })));
        return;
      }
      const chunks: Buffer[] = [];
      let received = 0;
      response.on("data", (chunk: Buffer) => {
        received += chunk.length;
        if (received > (expected.size ?? MAX_CUSTOM_BINARY_SIZE)) {
          fail(new Error(t("download.errorTooLarge")));
          request.destroy();
          return;
        }
        chunks.push(chunk);
        onProgress(received, Number(response.headers["content-length"]) || expected.size || 0);
      });
      response.on("end", () => {
        try {
          const data = Buffer.concat(chunks);
          if (expected.size !== undefined && data.length !== expected.size) throw new Error(t("download.errorSize", { bytes: data.length }));
          const hash = createHash("sha256").update(data).digest("hex");
          if (hash !== expected.sha256) throw new Error(t("download.errorHash"));
          writeFileSync(temporary, data, { flag: "wx" });
          renameSync(temporary, target);
          if (process.platform !== "win32") chmodSync(target, 0o755);
          if (!settled) {
            settled = true;
            resolve();
          }
        } catch (error) {
          fail(error instanceof Error ? error : new Error(String(error)));
        }
      });
      response.on("error", fail);
      });
      request.on("error", fail);
    };
    requestUrl(url, 0);
  });
}

function getPinnedUrl(platformKey: string): string {
  const repositoryPlatform = process.platform === "win32" ? "win" : process.platform === "darwin" ? "mac" : process.platform;
  const platformPath = `${repositoryPlatform}/${process.arch}`;
  const fileName = process.platform === "win32" ? "7za.exe" : "7za";
  if (!BINARIES[platformKey]) throw new Error(t("download.errorNoOfficial"));
  return `https://raw.githubusercontent.com/develar/7zip-bin/${PINNED_COMMIT}/${platformPath}/${fileName}`;
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
