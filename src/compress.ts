import { ChildProcess, spawn } from "child_process";
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { basename, join } from "path";
import { buildArgs } from "./engines";

export interface JobCallbacks {
  onProgress(percent: number | null): void;
  onDone(archivePath: string): void;
  onError(message: string): void;
}

export class CompressionJob {
  private child: ChildProcess | null = null;
  private cancelled = false;
  readonly tempDir: string;
  readonly archivePath: string;
  private readonly tarPath: string;

  constructor(
    private binaryPath: string,
    private parentDir: string,
    readonly folderName: string,
    readonly formatId: string,
    private levelId: string,
    private configDir: string,
    private cb: JobCallbacks
  ) {
    this.tempDir = join(tmpdir(), `obsidian-export-${Date.now()}`);
    const ext = formatId === "tgz" ? "tar.gz" : formatId;
    this.archivePath = join(this.tempDir, `${folderName}.${ext}`);
    this.tarPath = join(this.tempDir, `${folderName}.tar`);
  }

  start() {
    mkdirSync(this.tempDir, { recursive: true });

    if (this.formatId === "tgz") {
      const args = buildArgs(this.binaryPath, this.folderName, "tar", this.levelId, this.tarPath, this.configDir);
      this.spawnOnce(args, (code, stderr) => {
        if (this.cancelled) return;
        if (code !== 0) return this.fail(stderr || `El proceso terminó con código ${code}`);
        this.spawnOnce(["a", "-tgzip", "-y", this.archivePath, basename(this.tarPath)], (code2, stderr2) => {
          if (this.cancelled) return;
          if (code2 !== 0) return this.fail(stderr2 || `El proceso terminó con código ${code2}`);
          try {
            unlinkSync(this.tarPath);
          } catch {
            // el tar ya no existe: nada que limpiar
          }
          this.cb.onDone(this.archivePath);
        });
      });
    } else {
      const args = buildArgs(this.binaryPath, this.folderName, this.formatId, this.levelId, this.archivePath, this.configDir);
      this.spawnOnce(args, (code, stderr) => {
        if (this.cancelled) return;
        if (code !== 0) return this.fail(stderr || `El proceso terminó con código ${code}`);
        if (!existsSync(this.archivePath)) return this.fail("El motor no generó el archivo de salida.");
        this.cb.onDone(this.archivePath);
      });
    }
  }

  cancel() {
    this.cancelled = true;
    try {
      this.child?.kill();
    } catch {
      // el proceso ya terminó
    }
    this.cleanup();
  }

  cleanup() {
    try {
      rmSync(this.tempDir, { recursive: true, force: true });
    } catch {
      // mejor esfuerzo: el SO limpia el %TEMP% eventualmente
    }
  }

  private spawnOnce(args: string[], done: (code: number | null, stderr: string) => void) {
    this.child = spawn(this.binaryPath, args, { cwd: this.parentDir, windowsHide: true });
    let stderr = "";
    this.child.stdout?.on("data", (d: Buffer) => this.parseProgress(d.toString()));
    this.child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    this.child.on("error", (e) => {
      this.child = null;
      this.fail(e.message);
    });
    this.child.on("close", (code) => {
      this.child = null;
      done(code, stderr.trim());
    });
  }

  private parseProgress(text: string) {
    const matches = text.match(/(\d{1,3})%/g);
    if (!matches) return;
    const pct = parseInt(matches[matches.length - 1], 10);
    if (!Number.isNaN(pct)) this.cb.onProgress(Math.min(pct, 100));
  }

  private fail(message: string) {
    this.cleanup();
    this.cb.onError(message);
  }
}

export function uniqueTargetPath(dir: string, baseName: string, ext: string): string {
  const plain = join(dir, `${baseName}.${ext}`);
  if (!existsSync(plain)) return plain;
  const ts = new Date()
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 15);
  return join(dir, `${baseName}-${ts}.${ext}`);
}

export function moveArchive(src: string, dest: string) {
  try {
    renameSync(src, dest);
  } catch {
    // otro volumen o permisos: copiar + borrar
    copyFileSync(src, dest);
    unlinkSync(src);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
