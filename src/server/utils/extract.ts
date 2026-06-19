import { extract } from "tar";
import AdmZip from "adm-zip";

/**
 * Extract a .tar.gz archive to a destination directory.
 * Pure JavaScript — no system `tar` command needed.
 */
export async function extractTarGz(
  archivePath: string,
  destDir: string
): Promise<void> {
  await extract({
    file: archivePath,
    cwd: destDir,
  });
}

/**
 * Extract a .zip archive to a destination directory.
 * Pure JavaScript — no PowerShell or system unzip needed.
 */
export function extractZip(archivePath: string, destDir: string): void {
  const zip = new AdmZip(archivePath);
  zip.extractAllTo(destDir, true);
}
