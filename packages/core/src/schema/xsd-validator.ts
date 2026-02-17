/**
 * XSD validation via libxml2-wasm.
 *
 * Validates XML documents against XSD schemas using the WASM-compiled
 * libxml2 library. Handles WASM lifecycle, input providers for resolving
 * xsd:include/xsd:import, and proper memory disposal.
 *
 * Parsed XSD schemas are cached in memory so that multi-file validation
 * sessions only pay the (expensive) schema-parsing cost once. The cache
 * is keyed by absolute XSD path and entries are evicted after a
 * configurable TTL (default 30 minutes).
 *
 * Performance: XSD include/import resolution is accelerated by pre-reading
 * all .xsd files from the schema directory into memory and serving them
 * via an `XmlBufferInputProvider`. This eliminates ~2,000+ synchronous
 * filesystem round-trips through the WASM↔JS boundary that the default
 * fs-based provider would require for large schema trees like NeTEx (372 files).
 */

import {
  ParseOption,
  XmlBufferInputProvider,
  XmlDocument,
  XmlValidateError,
  XsdValidator,
  xmlRegisterInputProvider,
} from "libxml2-wasm";
import { xmlRegisterFsInputProviders } from "libxml2-wasm/lib/nodejs.mjs";

import { xsdError } from "../errors.js";
import { createLogger } from "../logger.js";
import type { ValidationError } from "../types.js";

const log = createLogger("xsd-validator");

/** Whether the base filesystem input providers have been registered. */
let fsProvidersRegistered = false;

/**
 * Ensure filesystem input providers are registered as a fallback.
 * The buffer provider takes priority (registered after), but the fs
 * provider handles any files not pre-loaded into memory.
 */
function ensureFsProviders(): void {
  if (!fsProvidersRegistered) {
    xmlRegisterFsInputProviders();
    fsProvidersRegistered = true;
  }
}

/** How long cached validators stay alive after last use (ms). */
const CACHE_TTL_MS = 30 * 60_000;

interface CachedValidator {
  /** The parsed XSD document (owns WASM memory — must be disposed). */
  xsdDoc: XmlDocument;
  /** The compiled validator (owns WASM memory — must be disposed). */
  validator: XsdValidator;
  /** Timestamp of last use (for TTL eviction). */
  lastUsed: number;
  /** Handle for the eviction timer. */
  timer: ReturnType<typeof setTimeout>;
}

const validatorCache = new Map<string, CachedValidator>();

/**
 * In-memory cache of pre-read XSD file buffers, keyed by `file://` URL.
 * Populated once per schema directory and shared across all validators
 * using schemas from that directory.
 */
let activeBufferProvider: XmlBufferInputProvider | null = null;
let bufferProviderRegistered = false;
const preloadedDirs = new Set<string>();

/**
 * Pre-read all .xsd files from a directory tree into the buffer provider.
 * Skips directories that have already been preloaded.
 *
 * @param schemaDir - The root directory containing .xsd files.
 */
async function preloadSchemaDir(schemaDir: string): Promise<void> {
  if (preloadedDirs.has(schemaDir)) return;

  const { readFile, readdir } = await import("node:fs/promises");
  const { join } = await import("node:path");

  if (!activeBufferProvider) {
    activeBufferProvider = new XmlBufferInputProvider({});
  }

  // Recursively find and read all .xsd files.
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    const promises: Promise<void>[] = [];

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        promises.push(walk(fullPath));
      } else if (entry.isFile() && entry.name.endsWith(".xsd")) {
        promises.push(
          readFile(fullPath).then((buf) => {
            activeBufferProvider!.addBuffer(pathToFileUrl(fullPath), buf);
          }),
        );
      }
    }

    await Promise.all(promises);
  };

  await walk(schemaDir);
  preloadedDirs.add(schemaDir);

  // Register the buffer provider (once) — AFTER fs providers so it takes priority.
  if (!bufferProviderRegistered) {
    ensureFsProviders();
    xmlRegisterInputProvider(activeBufferProvider);
    bufferProviderRegistered = true;
  }
}

/**
 * Compute a SHA-256 hex digest of a buffer. Used as a content-based cache
 * key so that identical schemas uploaded to different temp directories
 * produce a cache HIT instead of re-compiling.
 */
async function hashBuffer(buf: Uint8Array): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Get (or create) a cached XsdValidator for the given schema path.
 * Resets the TTL on every access.
 *
 * The cache is keyed by a SHA-256 hash of the entry XSD content, not by
 * file path. This means the same schema uploaded to different temp
 * directories will produce a cache HIT.
 */
async function getCachedValidator(xsdPath: string): Promise<XsdValidator> {
  const entryBuffer = await readFileAsBuffer(xsdPath);
  const cacheKey = await hashBuffer(entryBuffer);

  const existing = validatorCache.get(cacheKey);
  if (existing) {
    existing.lastUsed = Date.now();
    clearTimeout(existing.timer);
    existing.timer = setTimeout(() => evictValidator(cacheKey), CACHE_TTL_MS);
    log("cache HIT (hash:", `${cacheKey.slice(0, 8)}...)`);
    return existing.validator;
  }

  log("cache MISS (hash:", `${cacheKey.slice(0, 8)}...) for`, xsdPath);
  const t0 = performance.now();

  // Pre-load all XSD files from the schema directory into memory buffers.
  const { dirname } = await import("node:path");
  const schemaDir = findSchemaRoot(xsdPath);
  const resolvedDir = schemaDir ?? dirname(xsdPath);
  log("preloading schema dir:", resolvedDir);
  await preloadSchemaDir(resolvedDir);
  const t1 = performance.now();
  log(`preloadSchemaDir: ${(t1 - t0).toFixed(1)}ms`);

  // Parse the entry XSD — includes are now resolved from memory buffers.
  const xsdDoc = XmlDocument.fromBuffer(entryBuffer, {
    url: pathToFileUrl(xsdPath),
  });
  const t2 = performance.now();
  log(`XmlDocument.fromBuffer (parse XSD): ${(t2 - t1).toFixed(1)}ms`);

  let validator: XsdValidator;
  try {
    validator = XsdValidator.fromDoc(xsdDoc);
  } catch (err) {
    xsdDoc.dispose();
    throw err;
  }
  const t3 = performance.now();
  log(`XsdValidator.fromDoc (compile): ${(t3 - t2).toFixed(1)}ms`);
  log(`total cold start: ${(t3 - t0).toFixed(1)}ms`);

  const timer = setTimeout(() => evictValidator(cacheKey), CACHE_TTL_MS);
  validatorCache.set(cacheKey, {
    xsdDoc,
    validator,
    lastUsed: Date.now(),
    timer,
  });
  return validator;
}

/** Dispose and remove a cached validator entry by its cache key. */
function evictValidator(cacheKey: string): void {
  const entry = validatorCache.get(cacheKey);
  if (!entry) return;
  validatorCache.delete(cacheKey);
  try {
    entry.validator.dispose();
  } catch {
    /* already disposed */
  }
  try {
    entry.xsdDoc.dispose();
  } catch {
    /* already disposed */
  }
}

/**
 * Dispose all cached validators immediately.
 * Useful for tests or graceful shutdown.
 */
export function disposeValidatorCache(): void {
  for (const [key] of validatorCache) {
    evictValidator(key);
  }
}

/**
 * Pre-warm the XSD validator cache for the given schema path.
 *
 * Call this at server startup or on first request to avoid the cold-start
 * penalty on the first validation. The schema files are pre-loaded into
 * memory and the XSD validator is parsed and compiled.
 *
 * @param xsdPath - Absolute path to the entry XSD file.
 */
export async function warmUpValidator(xsdPath: string): Promise<void> {
  ensureFsProviders();
  await getCachedValidator(xsdPath);
}

/**
 * Validate XML content against an XSD schema file on disk.
 *
 * The parsed XSD schema is cached so that subsequent calls with the same
 * `xsdPath` skip the expensive schema-parsing step.
 *
 * Accepts either a string or a `Uint8Array`. When raw bytes are provided
 * the buffer API is used, which skips the JS string → UTF-8 encoding step
 * and is more efficient for content already in binary form.
 *
 * @param xml - The XML content to validate (string or raw bytes).
 * @param xsdPath - Absolute path to the entry XSD file.
 * @returns Array of validation errors (empty = valid).
 */
export async function validateXsd(
  xml: string | Uint8Array,
  xsdPath: string,
): Promise<ValidationError[]> {
  ensureFsProviders();

  let xmlDoc: XmlDocument | undefined;

  const parseOpts = {
    option: ParseOption.XML_PARSE_NONET | ParseOption.XML_PARSE_NOENT,
  };

  try {
    const tv0 = performance.now();
    const validator = await getCachedValidator(xsdPath);
    const tv1 = performance.now();
    log(`getCachedValidator: ${(tv1 - tv0).toFixed(1)}ms`);

    // Parse the XML document — use the buffer API when raw bytes are available.
    xmlDoc =
      typeof xml === "string"
        ? XmlDocument.fromString(xml, parseOpts)
        : XmlDocument.fromBuffer(xml, parseOpts);
    const tv2 = performance.now();
    log(`parse XML document: ${(tv2 - tv1).toFixed(1)}ms`);

    // Run validation — throws XmlValidateError if invalid.
    validator.validate(xmlDoc);
    const tv3 = performance.now();
    log(`validate(): ${(tv3 - tv2).toFixed(1)}ms`);
    log(`total validateXsd: ${(tv3 - tv0).toFixed(1)}ms`);

    return []; // Valid!
  } catch (err) {
    if (err instanceof XmlValidateError) {
      return err.details.map((detail) =>
        xsdError(detail.message.trim(), detail.line, detail.col),
      );
    }

    // Unexpected error (parse error, etc.)
    return [
      xsdError(
        `XSD validation failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    ];
  } finally {
    // Only dispose the XML document — the validator is cached.
    xmlDoc?.dispose();
  }
}

/** Read a file as raw bytes — avoids UTF-8 decode overhead for libxml2 buffer API. */
async function readFileAsBuffer(filePath: string): Promise<Uint8Array> {
  const { readFile } = await import("node:fs/promises");
  // Node Buffer is a Uint8Array subclass — no copy needed.
  return readFile(filePath);
}

/**
 * Convert a file path to a file:// URL.
 * libxml2 uses the URL as the base for resolving relative includes.
 */
function pathToFileUrl(filePath: string): string {
  if (filePath.startsWith("/")) {
    return `file://${filePath}`;
  }
  // Windows: C:\foo\bar → file:///C:/foo/bar
  return `file:///${filePath.replace(/\\/g, "/")}`;
}

/**
 * Walk up from the entry XSD path to find the schema root directory.
 * Looks for the cache directory pattern (e.g. `schemas/netex-1.2-nc/`).
 * Returns `null` if no recognizable root is found.
 */
function findSchemaRoot(xsdPath: string): string | null {
  // The cache directory contains a single extracted archive root like
  // `~/.cache/transmodel-validator/schemas/netex-1.2-nc/NeTEx-1.2/`.
  // We want the cache entry dir (e.g. `.../schemas/netex-1.2-nc/`).
  const marker = "/schemas/";
  const idx = xsdPath.indexOf(marker);
  if (idx === -1) return null;

  // The path after "schemas/" starts with the schema ID dir.
  const afterSchemas = xsdPath.slice(idx + marker.length);
  const slashIdx = afterSchemas.indexOf("/");
  if (slashIdx === -1) return null;

  return xsdPath.slice(0, idx + marker.length + slashIdx);
}
