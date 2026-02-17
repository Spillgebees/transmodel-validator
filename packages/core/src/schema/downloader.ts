/**
 * Schema downloader + cache manager.
 *
 * Downloads XSD schema archives from GitHub, extracts them, and caches
 * them locally at `~/.cache/transmodel-validator/schemas/`.
 */

import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { SchemaId } from "@transmodel-validator/shared";
import { SCHEMA_REGISTRY, type SchemaEntry } from "./registry.js";

const CACHE_ROOT = join(homedir(), ".cache", "transmodel-validator", "schemas");

/** Get the cache directory for a given schema ID. */
export function getCacheDir(schemaId: Exclude<SchemaId, "custom">): string {
  return join(CACHE_ROOT, schemaId.replace("@", "-"));
}

/** Check whether a schema is already cached. */
export async function isCached(
  schemaId: Exclude<SchemaId, "custom">,
): Promise<boolean> {
  const dir = getCacheDir(schemaId);
  if (!existsSync(dir)) return false;
  // Quick sanity check — the directory should not be empty.
  const entries = await readdir(dir);
  return entries.length > 0;
}

/**
 * Ensure a schema is available locally. Downloads and extracts if not cached.
 *
 * @returns Absolute path to the directory containing the extracted XSD files.
 */
export async function ensureSchema(
  schemaId: Exclude<SchemaId, "custom">,
): Promise<string> {
  if (await isCached(schemaId)) {
    return getCacheDir(schemaId);
  }

  const entry = SCHEMA_REGISTRY[schemaId];
  if (!entry) {
    throw new Error(`Unknown schema ID: ${schemaId}`);
  }

  return downloadAndExtract(schemaId, entry);
}

/**
 * Resolve the absolute path to the entry XSD file for a schema.
 *
 * Calls `ensureSchema` first to guarantee the files exist.
 */
export async function resolveEntryXsd(
  schemaId: Exclude<SchemaId, "custom">,
): Promise<string> {
  const cacheDir = await ensureSchema(schemaId);
  const entry = SCHEMA_REGISTRY[schemaId];

  // The archive extracts with a root directory (e.g. `NeTEx-1.2/`).
  // We need to find it inside the cache.
  const entries = await readdir(cacheDir);
  const _root = entries.find(
    (e) => e.endsWith("/") || existsSync(join(cacheDir, e, entry.entryXsd)),
  );

  // Try with and without the archive root prefix.
  const candidates = [
    join(cacheDir, entry.entryXsd),
    join(cacheDir, entry.archiveRootPrefix, entry.entryXsd),
    // GitHub archives sometimes use different casing
    ...entries.map((e) => join(cacheDir, e, entry.entryXsd)),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Entry XSD not found for ${schemaId}. Expected at ${entry.entryXsd} ` +
      `within cache directory ${cacheDir}. Contents: ${entries.join(", ")}`,
  );
}

/** Remove a specific cached schema. */
export async function clearCache(
  schemaId: Exclude<SchemaId, "custom">,
): Promise<void> {
  const dir = getCacheDir(schemaId);
  if (existsSync(dir)) {
    await rm(dir, { recursive: true });
  }
}

/** Remove all cached schemas. */
export async function clearAllCaches(): Promise<void> {
  if (existsSync(CACHE_ROOT)) {
    await rm(CACHE_ROOT, { recursive: true });
  }
}

async function downloadAndExtract(
  schemaId: Exclude<SchemaId, "custom">,
  entry: SchemaEntry,
): Promise<string> {
  const cacheDir = getCacheDir(schemaId);
  await mkdir(cacheDir, { recursive: true });

  const zipPath = join(cacheDir, "__download.zip");

  try {
    // Download
    const response = await fetch(entry.archiveUrl, { redirect: "follow" });
    if (!response.ok) {
      throw new Error(
        `Failed to download schema ${schemaId}: HTTP ${response.status} ${response.statusText}`,
      );
    }

    if (!response.body) {
      throw new Error(`No response body for schema ${schemaId}`);
    }

    // Write the zip to disk
    const fileStream = createWriteStream(zipPath);
    await pipeline(Readable.fromWeb(response.body as never), fileStream);

    // Extract using the built-in unzip approach.
    // Node.js doesn't have built-in zip extraction, so we'll use a
    // child process with `unzip` which is available on most systems,
    // or fall back to a manual approach.
    await extractZip(zipPath, cacheDir);

    return cacheDir;
  } finally {
    // Clean up the downloaded zip
    try {
      if (existsSync(zipPath)) {
        await rm(zipPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function extractZip(zipPath: string, destDir: string): Promise<void> {
  // Use Node.js child_process to call `unzip`. This avoids adding a
  // zip library dependency. The `unzip` command is available on most
  // Linux/macOS systems and in Docker images.
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  try {
    await execFileAsync("unzip", ["-o", "-q", zipPath, "-d", destDir]);
  } catch (err) {
    // If unzip is not available, try with `tar` (some systems have it
    // and GitHub zip files can sometimes be handled). Otherwise re-throw.
    throw new Error(
      `Failed to extract schema archive. Ensure 'unzip' is installed.\n` +
        `Original error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
