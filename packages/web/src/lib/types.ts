/**
 * Client-side types for the web UI.
 *
 * Types are duplicated from core to avoid importing Node.js code into
 * the browser bundle.
 */

/** A single validation error. */
export interface ValidationError {
  message: string;
  source: "xsd" | "rule";
  severity: "error" | "warning" | "info";
  category: "consistency" | "quality" | "not-found" | "skipped" | "general";
  rule?: string;
  line?: number;
  column?: number;
}

/** Validation result for a single file. */
export interface FileResult {
  fileName: string;
  format: "netex" | "siri";
  errors: ValidationError[];
  passed: boolean;
  /**
   * Names of all rules/checks that were executed against this file.
   * Includes "xsd" if XSD validation was run. Used to derive which
   * rules passed (rulesRun minus rules that produced errors/skipped).
   */
  rulesRun?: string[];
  /**
   * Wall-clock duration of each rule/check, in milliseconds.
   * Keys match entries in `rulesRun` (e.g. rule name or "xsd").
   */
  ruleTiming?: Record<string, number>;
}

/** Aggregate validation result for an entire session. */
export interface ValidationResult {
  files: FileResult[];
  totalFiles: number;
  passedFiles: number;
  failedFiles: number;
  totalErrors: number;
  durationMs: number;
}

/**
 * Sparse line map for a single file: line number (1-indexed) -> line content.
 * Only includes lines near errors (±CONTEXT_LINES).
 */
export type XmlSnippet = Record<number, string>;

/** A validation session stored in localStorage. */
export interface Session {
  id: string;
  format: "netex" | "siri" | "auto";
  /** Schema version used (or "none"/"custom"). */
  schemaId: string;
  fileNames: string[];
  result: ValidationResult;
  /** Sparse line maps per file, for the code viewer. Small enough for localStorage. */
  xmlSnippets?: Record<string, XmlSnippet>;
  createdAt: string; // ISO 8601
  /** Original filename of the custom schema (if a custom schema was used). */
  customSchemaFileName?: string;
  /** User-chosen root XSD path within a zip schema archive. */
  customSchemaRootXsd?: string;
  /** Absolute filesystem path to the resolved XSD schema used for validation. */
  resolvedSchemaPath?: string;
}

/** File ready for validation (selected by the user). */
export interface SelectedFile {
  id: string;
  name: string;
  size: number;
  /** The original browser File object — sent directly via FormData. */
  file: File;
  isArchive: boolean;
}

/** Validation config selected in the UI. */
export interface ValidationConfig {
  format: "auto" | "netex" | "siri";
  /** Schema version ID, or "none" for rules-only, or "custom" for user-provided. */
  schemaId: string;
  enabledRules: string[];
  /** Base64-encoded custom XSD schema (zip or .xsd file). */
  customSchemaBase64?: string;
  /** Original filename of the custom schema. */
  customSchemaFileName?: string;
  /**
   * For zip archives with multiple .xsd files: the relative path of the
   * user-chosen root/entry XSD within the archive. Undefined for single .xsd uploads.
   */
  customSchemaRootXsd?: string;
  /**
   * List of .xsd paths discovered inside the uploaded zip archive.
   * Populated by the server after upload; used to render the root picker dropdown.
   */
  customSchemaXsdFiles?: string[];
}
