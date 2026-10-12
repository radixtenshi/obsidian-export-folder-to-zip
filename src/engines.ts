import { existsSync } from "fs";

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

const EXCLUDES_7Z = ["-x!.obsidian/*", "-x!.git/*", "-x!*/.obsidian/*", "-x!*/.git/*"];
const EXCLUDES_RAR = ["-x.obsidian", "-x.git", "-x*/.obsidian", "-x*/.git"];

export function engineKindForBinary(path: string): EngineKind | null {
  const p = path.toLowerCase();
  if (p.includes("7z")) return "7zip";
  if (p.includes("rar")) return "winrar";
  return null;
}

export function detectInstalled(): { name: string; path: string }[] {
  const found: { name: string; path: string }[] = [];
  const roots = ["C:\\Program Files", "C:\\Program Files (x86)"];
  const candidates: [string, string, string][] = [
    ["7-Zip\\7z.exe", "7-Zip", "7zip"],
    ["WinRAR\\WinRAR.exe", "WinRAR", "winrar"],
    ["WinRAR\\Rar.exe", "WinRAR (Rar)", "winrar"],
  ];
  for (const root of roots) {
    for (const [rel, name, kind] of candidates) {
      const p = `${root}\\${rel}`;
      if (existsSync(p) && !found.some((f) => f.path === p)) found.push({ name: `${name} (${kind})`, path: p });
    }
  }
  return found;
}

const ARCHIVE_PLACEHOLDER = "__ARCHIVE__";

export function buildArgs(
  binaryPath: string,
  folderName: string,
  formatId: string,
  levelId: string,
  archivePath: string
): string[] {
  const kind = engineKindForBinary(binaryPath);
  const raw =
    kind === "winrar"
      ? buildWinrarArgs(formatId, levelId, folderName)
      : build7zArgs(formatId, levelId, folderName);
  return raw.map((a) => (a === ARCHIVE_PLACEHOLDER ? archivePath : a));
}

function build7zArgs(formatId: string, levelId: string, folderName: string): string[] {
  return ["a", `-t${formatId}`, `-mx=${levelId}`, "-y", ARCHIVE_PLACEHOLDER, folderName, ...EXCLUDES_7Z];
}

function buildWinrarArgs(formatId: string, levelId: string, folderName: string): string[] {
  const args = ["a", "-inul", "-y", `-m${levelId}`];
  if (formatId === "zip") args.push("-afzip");
  args.push(ARCHIVE_PLACEHOLDER, folderName, ...EXCLUDES_RAR);
  return args;
}
