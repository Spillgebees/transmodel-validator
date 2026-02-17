/**
 * Archive extraction.
 *
 * Supports .zip, .gz, .tar, .tar.gz, .tar.bz2 archives.
 * Extracts XML files and returns their contents.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import type { DocumentInput } from "../types.js";

const execFileAsync = promisify(execFile);

/**
 * Determine if a file path looks like an archive we can handle.
 */
export function isArchive(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.endsWith(".zip") ||
    lower.endsWith(".gz") ||
    lower.endsWith(".tar") ||
    lower.endsWith(".tar.gz") ||
    lower.endsWith(".tgz") ||
    lower.endsWith(".tar.bz2") ||
    lower.endsWith(".tbz2")
  );
}

/**
 * Extract XML files from an archive.
 *
 * @param archivePath - Path to the archive file.
 * @returns Array of DocumentInput with fileName and xml content.
 */
export async function extractXmlFromArchive(
  archivePath: string,
): Promise<DocumentInput[]> {
  const lower = archivePath.toLowerCase();
  const tempDir = join(
    tmpdir(),
    `transmodel-validator-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  try {
    await mkdir(tempDir, { recursive: true });

    if (lower.endsWith(".zip")) {
      await execFileAsync("unzip", ["-o", "-q", archivePath, "-d", tempDir]);
    } else if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) {
      await execFileAsync("tar", ["-xzf", archivePath, "-C", tempDir]);
    } else if (lower.endsWith(".tar.bz2") || lower.endsWith(".tbz2")) {
      await execFileAsync("tar", ["-xjf", archivePath, "-C", tempDir]);
    } else if (lower.endsWith(".tar")) {
      await execFileAsync("tar", ["-xf", archivePath, "-C", tempDir]);
    } else if (lower.endsWith(".gz")) {
      // Single .gz file — decompress with gunzip
      await execFileAsync("gunzip", ["-k", "-c", archivePath], {
        maxBuffer: 100 * 1024 * 1024, // 100MB
      });
      // For a single .gz, the content goes to stdout.
      const { stdout } = await execFileAsync("gunzip", ["-c", archivePath], {
        maxBuffer: 100 * 1024 * 1024,
        encoding: "utf-8",
      });
      const baseName = archivePath.replace(/\.gz$/i, "");
      const fileName = baseName.split("/").pop() ?? "file.xml";
      return [{ fileName, xml: stdout }];
    } else {
      throw new Error(`Unsupported archive format: ${archivePath}`);
    }

    // Recursively find all XML files in the temp directory.
    return await collectXmlFiles(tempDir, tempDir);
  } finally {
    // Clean up temp directory.
    try {
      if (existsSync(tempDir)) {
        await rm(tempDir, { recursive: true });
      }
    } catch {
      // Ignore cleanup errors.
    }
  }
}

/**
 * Recursively collect all XML files from a directory.
 */
async function collectXmlFiles(
  dir: string,
  baseDir: string,
): Promise<DocumentInput[]> {
  const results: DocumentInput[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectXmlFiles(fullPath, baseDir)));
    } else if (
      entry.name.toLowerCase().endsWith(".xml") &&
      !entry.name.startsWith(".")
    ) {
      const xml = await readFile(fullPath, "utf-8");
      // Use relative path from base directory as fileName.
      const relativePath = fullPath.slice(baseDir.length + 1);
      results.push({ fileName: relativePath, xml });
    }
  }

  return results;
}
