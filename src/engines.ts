import { existsSync } from "fs";
import { join, win32 } from "path";

export interface FormatDef {
  id: string;
  label: string;
  ext: string;
}

export interface LevelDef {
  id: string;
  label: string;
}

export type EngineKind = "7zip" | "winrar";

export interface EngineSpec {
  kind: EngineKind;
  label: string;
  formats: FormatDef[];
  levels: LevelDef[];
}

export const ENGINES: Record<EngineKind, EngineSpec> = {
  "7zip": {
    kind: "7zip",
    label: "7-Zip",
    formats: [
      { id: "zip", label: "ZIP (.zip)", ext: "zip" },
      { id: "7z", label: "7z (.7z)", ext: "7z" },
      { id: "tar", label: "TAR (.tar)", ext: "tar" },
      { id: "tgz", label: "tar.gz (.tar.gz)", ext: "tar.gz" },
    ],
    levels: [
      { id: "0", label: "Almacenar (sin comprimir)" },
      { id: "3", label: "Rápido" },
      { id: "5", label: "Normal" },
      { id: "9", label: "Máximo" },
    ],
  },
  winrar: {
    kind: "winrar",
    label: "WinRAR",
    formats: [
      { id: "rar", label: "RAR (.rar)", ext: "rar" },
      { id: "zip", label: "ZIP (.zip)", ext: "zip" },
    ],
    levels: [
      { id: "0", label: "Almacenar" },
      { id: "1", label: "Muy rápido" },
      { id: "3", label: "Normal" },
      { id: "5", label: "Máximo" },
    ],
  },
};

function excludes7z(configDir: string): string[] {
  return [`-x!${configDir}/*`, "-x!.git/*", `-x!*/${configDir}/*`, "-x!*/.git/*"];
}

function excludesRar(configDir: string): string[] {
  return [`-x${configDir}`, "-x.git", `-x*/${configDir}`, "-x*/.git"];
}

export function engineKindForBinary(path: string): EngineKind | null {
  const p = path.toLowerCase();
  if (p.includes("7z")) return "7zip";
  if (p.includes("rar")) return "winrar";
  return null;
}

/** Prefer the console-capable Rar.exe when a configured WinRAR path has a sibling. */
export function executableForBinary(path: string): string {
  if (engineKindForBinary(path) === "7zip") {
    if (/\\7z\.exe$/i.test(path)) return path;
    if (/\\7zfm\.exe$/i.test(path)) {
      const consolePath = path.replace(/7zfm\.exe$/i, "7z.exe");
      if (existsSync(consolePath)) return consolePath;
    }
    if (/\\7zg\.exe$/i.test(path)) {
      const consolePath = path.replace(/7zg\.exe$/i, "7z.exe");
      if (existsSync(consolePath)) return consolePath;
    }
    return path;
  }
  if (engineKindForBinary(path) !== "winrar" || /\\rar\.exe$/i.test(path)) return path;
  const consolePath = path.replace(/[^\\/]+$/i, "Rar.exe");
  return existsSync(consolePath) ? consolePath : path;
}

export interface DetectedBinary {
  name: string;
  path: string;
}

export function detectInstalled(): { name: string; path: string }[] {
  const found: { name: string; path: string }[] = [];
  const candidates = new Map<string, string>();
  const add = (path: string | undefined, name: string) => {
    if (path && existsSync(path) && !candidates.has(path.toLowerCase())) candidates.set(path.toLowerCase(), name);
  };

  const programRoots = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA]
    .filter((root): root is string => Boolean(root));
  for (const root of programRoots) {
    add(join(root, "7-Zip", "7z.exe"), "7-Zip (7z.exe)");
    add(join(root, "WinRAR", "Rar.exe"), "WinRAR (Rar.exe)");
    add(join(root, "WinRAR", "WinRAR.exe"), "WinRAR (WinRAR.exe)");
  }

  // Common per-user install location and portable installations exposed through PATH.
  if (process.env.LOCALAPPDATA) add(join(process.env.LOCALAPPDATA, "Programs", "7-Zip", "7z.exe"), "7-Zip (usuario)");
  for (const executable of ["7z.exe", "rar.exe", "WinRAR.exe"]) {
    const foundInPath = findOnPath(executable);
    if (foundInPath) add(foundInPath, `${engineKindForBinary(executable) === "winrar" ? "WinRAR" : "7-Zip"} (PATH)`);
  }

  for (const [path, name] of candidates) found.push({ name, path });
  return found;
}

function findOnPath(executable: string): string | undefined {
  const pathValue = process.env.PATH ?? "";
  for (const directory of pathValue.split(";").map((part) => part.trim()).filter(Boolean)) {
    const candidate = join(directory.replace(/^"|"$/g, ""), executable);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

const ARCHIVE_PLACEHOLDER = "__ARCHIVE__";

export function buildArgs(
  binaryPath: string,
  folderName: string,
  formatId: string,
  levelId: string,
  archivePath: string,
  configDir: string,
  password?: string
): string[] {
  const kind = engineKindForBinary(binaryPath);
  const raw =
    kind === "winrar"
      ? buildWinrarArgs(formatId, levelId, folderName, configDir, password)
      : build7zArgs(formatId, levelId, folderName, configDir, password);
  return raw.map((a) => (a === ARCHIVE_PLACEHOLDER ? archivePath : a));
}

function build7zArgs(formatId: string, levelId: string, folderName: string, configDir: string, password?: string): string[] {
  const args = ["a", `-t${formatId}`, `-mx=${levelId}`, "-y"];
  if (password) args.push(`-p${password}`, "-mhe=on");
  return [...args, ARCHIVE_PLACEHOLDER, folderName, ...excludes7z(configDir)];
}

export function buildArgsForFolder(
  binaryPath: string,
  folderPath: string,
  folderName: string,
  formatId: string,
  levelId: string,
  archivePath: string,
  configDir: string,
  password?: string
): string[] {
  const args = buildArgs(binaryPath, folderName, formatId, levelId, archivePath, configDir, password);
  const sourceIndex = args.findIndex((arg) => arg === folderName);
  if (sourceIndex >= 0) args[sourceIndex] = win32.join(folderPath, "*");
  return args;
}

function buildWinrarArgs(formatId: string, levelId: string, folderName: string, configDir: string, password?: string): string[] {
  const args = ["a", "-inul", "-y", `-m${levelId}`];
  if (formatId === "zip") args.push("-afzip");
  if (password) args.push(`-p${password}`, "-hp");
  args.push(ARCHIVE_PLACEHOLDER, folderName, ...excludesRar(configDir));
  return args;
}
