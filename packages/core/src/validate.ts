/**
 * Public validation API.
 *
 * This is the main entry point for validating Transmodel XML files.
 * Both `validate()` (file-path based) and `validateDocuments()` (in-memory)
 * delegate to an internal `runValidation()` pipeline.
 */

import { readFile } from "node:fs/promises";

import { extractXmlFromArchive, isArchive } from "./archive/extract.js";
import { detectFormat } from "./formats/detect.js";
import { DEFAULT_PROFILE, getProfile } from "./profiles/index.js";
import { getRule, RULE_REGISTRY } from "./rules/registry.js";
import { resolveEntryXsd } from "./schema/downloader.js";
import { validateXsd } from "./schema/xsd-validator.js";
import type {
  DocumentInput,
  FileResult,
  ValidateOptions,
  ValidationError,
  ValidationResult,
} from "./types.js";

/**
 * Names of rules that require access to all documents simultaneously
 * (cross-document validation). These are run once with the full document
 * set rather than once per document.
 *
 * NOTE: `netexUniqueConstraints` checks uniqueness per-document (matching
 * W3C XSD §3.11.4 semantics) but remains in this set so the orchestrator
 * provides `xsdContent` via `ruleConfig`. It receives all documents but
 * resets its internal state for each one independently.
 */
const CROSS_DOC_RULES = new Set([
  "everyLineIsReferenced",
  "everyStopPlaceIsReferenced",
  "locationsAreReferencingTheSamePoint",
  "netexKeyRefConstraints",
  "netexPrerequisitesAreSatisfied",
  "netexUniqueConstraints",
]);

/**
 * Validate one or more Transmodel XML files.
 *
 * @param filePaths - Paths to XML files or archives containing XML files.
 * @param options - Validation options (profile, format, rules, etc.).
 * @returns Aggregate validation result.
 */
export async function validate(
  filePaths: string[],
  options: ValidateOptions = {},
): Promise<ValidationResult> {
  const documents = await loadDocuments(filePaths);
  return runValidation(documents, options);
}

/**
 * Validate documents that are already loaded into memory.
 * Useful for the web UI where files come from the browser.
 *
 * @param documents - Array of in-memory XML documents.
 * @param options - Validation options (profile, format, rules, etc.).
 * @returns Aggregate validation result.
 */
export async function validateDocuments(
  documents: DocumentInput[],
  options: ValidateOptions = {},
): Promise<ValidationResult> {
  return runValidation(documents, options);
}

/**
 * Internal shared validation pipeline.
 * Both `validate()` and `validateDocuments()` delegate to this after
 * loading documents.
 *
 * @param documents - Array of in-memory XML documents.
 * @param options - Validation options (profile, format, rules, progress, etc.).
 * @returns Aggregate validation result.
 */
async function runValidation(
  documents: DocumentInput[],
  options: ValidateOptions,
): Promise<ValidationResult> {
  const startTime = performance.now();
  const progress = options.onProgress;

  if (documents.length === 0) {
    return {
      files: [],
      totalFiles: 0,
      passedFiles: 0,
      failedFiles: 0,
      totalErrors: 0,
      durationMs: 0,
    };
  }

  // 1. Detect format (from first document, or from options).
  const detectedFormat =
    options.format && options.format !== "auto"
      ? options.format
      : detectFormat(documents[0].xml);

  // 2. Resolve profile.
  const profileName =
    options.profile ?? DEFAULT_PROFILE[detectedFormat] ?? "netex-fast-v1.2";
  const profile = getProfile(profileName);

  // 3. Determine which rules to run.
  const ruleNames = options.rules ?? profile.enabledRules;
  const allRules = ruleNames
    .filter((name) => RULE_REGISTRY.has(name))
    .map((name) => getRule(name));

  // Split into per-document rules and cross-document rules.
  const perDocRules = allRules.filter((r) => !CROSS_DOC_RULES.has(r.name));
  const crossDocRules = allRules.filter((r) => CROSS_DOC_RULES.has(r.name));

  // 4. Resolve XSD path + content for cross-doc rules.
  const schemaId = options.schemaId ?? profile.schemaId;
  let xsdPath: string | undefined;
  let xsdContent: string | undefined;

  if (schemaId) {
    try {
      if (schemaId === "custom") {
        if (options.customSchemaPath) {
          xsdPath = options.customSchemaPath;
          xsdContent = await readFile(xsdPath, "utf-8");
        }
      } else {
        xsdPath = await resolveEntryXsd(schemaId);
        xsdContent = await readFile(xsdPath, "utf-8");
      }
    } catch {
      // Non-critical — XSD validation and cross-doc rules will handle the absence.
    }
  }

  // Build ruleConfig with xsdContent for cross-doc rules.
  const ruleConfig: Record<string, Record<string, unknown>> = {
    ...options.ruleConfig,
  };
  if (xsdContent) {
    for (const rule of crossDocRules) {
      ruleConfig[rule.name] = {
        ...ruleConfig[rule.name],
        xsdContent,
      };
    }
  }

  // 5. Run per-document rules + XSD validation.
  const fileResults: FileResult[] = [];
  const totalFiles = documents.length;

  for (let i = 0; i < totalFiles; i++) {
    const doc = documents[i];
    const docFormat =
      options.format && options.format !== "auto"
        ? options.format
        : detectFormat(doc.xml);

    const errors: ValidationError[] = [];
    const rulesRun: string[] = [];
    const ruleTiming: Record<string, number> = {};

    // Run each applicable per-document rule (unless skipRules is set).
    if (!options.skipRules) {
      progress?.({
        phase: "rules",
        fileIndex: i,
        totalFiles,
        fileName: doc.fileName,
      });

      for (const rule of perDocRules) {
        if (!rule.formats.includes(docFormat)) continue;
        rulesRun.push(rule.name);

        const ruleStart = performance.now();
        try {
          const rc = ruleConfig[rule.name];
          const ruleErrors = await rule.run([doc], rc);
          errors.push(...ruleErrors);
        } catch (err) {
          errors.push({
            message: `Rule "${rule.name}" threw an error: ${err instanceof Error ? err.message : String(err)}`,
            source: "rule",
            severity: "error",
            category: "general",
            rule: rule.name,
          });
        }
        ruleTiming[rule.name] = Math.round(performance.now() - ruleStart);
      }
    }

    // XSD validation (unless skipXsd is set).
    if (schemaId && !options.skipXsd) {
      progress?.({
        phase: "xsd",
        fileIndex: i,
        totalFiles,
        fileName: doc.fileName,
      });

      rulesRun.push("xsd");
      const xsdStart = performance.now();
      try {
        let resolvedXsdPath: string;
        if (schemaId === "custom") {
          if (!options.customSchemaPath) {
            throw new Error(
              "Custom schema selected but no customSchemaPath provided.",
            );
          }
          resolvedXsdPath = options.customSchemaPath;
        } else {
          resolvedXsdPath = xsdPath ?? (await resolveEntryXsd(schemaId));
        }
        const xsdErrors = await validateXsd(doc.xml, resolvedXsdPath);
        errors.push(...xsdErrors);
      } catch (err) {
        errors.push({
          message: `XSD validation setup failed: ${err instanceof Error ? err.message : String(err)}`,
          source: "xsd",
          severity: "error",
          category: "general",
        });
      }
      ruleTiming.xsd = Math.round(performance.now() - xsdStart);
    }

    const realErrors = errors.filter((e) => e.severity !== "info");
    fileResults.push({
      fileName: doc.fileName,
      format: docFormat,
      errors,
      passed: realErrors.length === 0,
      rulesRun,
      ruleTiming,
    });

    progress?.({
      phase: "file-done",
      fileIndex: i,
      totalFiles,
      fileName: doc.fileName,
    });
  }

  // 6. Run cross-document rules once with all documents (unless skipRules is set).
  if (!options.skipRules && crossDocRules.length > 0 && documents.length > 0) {
    progress?.({ phase: "cross-doc", totalFiles });

    const docFormat =
      options.format && options.format !== "auto"
        ? options.format
        : detectFormat(documents[0].xml);

    for (const rule of crossDocRules) {
      if (!rule.formats.includes(docFormat)) continue;

      const ruleStart = performance.now();
      let ruleErrors: ValidationError[] = [];
      try {
        const rc = ruleConfig[rule.name];
        ruleErrors = await rule.run(documents, rc);
      } catch (err) {
        ruleErrors = [
          {
            message: `Rule "${rule.name}" threw an error: ${err instanceof Error ? err.message : String(err)}`,
            source: "rule",
            severity: "error",
            category: "general",
            rule: rule.name,
          },
        ];
      }
      const elapsed = Math.round(performance.now() - ruleStart);

      // Add rule name + timing to every file result, distribute errors by fileName.
      for (const fr of fileResults) {
        fr.rulesRun.push(rule.name);
        fr.ruleTiming[rule.name] = elapsed;
      }
      if (fileResults.length > 0) {
        for (const err of ruleErrors) {
          const target = err.fileName
            ? fileResults.find((fr) => fr.fileName === err.fileName)
            : undefined;
          (target ?? fileResults[0]).errors.push(err);
        }
        for (const fr of fileResults) {
          fr.passed =
            fr.errors.filter((e) => e.severity !== "info").length === 0;
        }
      }
    }
  }

  // 7. Build aggregate result.
  const durationMs = Math.round(performance.now() - startTime);
  const passedFiles = fileResults.filter((f) => f.passed).length;

  const result: ValidationResult = {
    files: fileResults,
    totalFiles: fileResults.length,
    passedFiles,
    failedFiles: fileResults.length - passedFiles,
    totalErrors: fileResults.reduce(
      (sum, f) => sum + f.errors.filter((e) => e.severity !== "info").length,
      0,
    ),
    durationMs,
  };

  progress?.({ phase: "complete", totalFiles });

  return result;
}

/**
 * Load XML documents from file paths, extracting archives when needed.
 *
 * @param filePaths - Paths to XML files or archives.
 * @returns Array of in-memory documents.
 */
async function loadDocuments(filePaths: string[]): Promise<DocumentInput[]> {
  const documents: DocumentInput[] = [];

  for (const filePath of filePaths) {
    if (isArchive(filePath)) {
      const archiveDocuments = await extractXmlFromArchive(filePath);
      documents.push(...archiveDocuments);
    } else {
      const xml = await readFile(filePath, "utf-8");
      const fileName = filePath.split("/").pop() ?? filePath;
      documents.push({ fileName, xml });
    }
  }

  return documents;
}
