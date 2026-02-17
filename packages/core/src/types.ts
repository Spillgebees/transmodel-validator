/**
 * Shared types for the transmodel-validator core.
 */

import type { TransmodelFormat } from "./formats/detect.js";

/** Severity / category of a validation error. */
export type ErrorSeverity = "error" | "warning" | "info";

/** The origin of the error — which subsystem produced it. */
export type ErrorSource = "xsd" | "rule";

/**
 * Classification of business-rule errors.
 *
 * - `consistency` — structural / referential integrity issue
 * - `quality`     — data quality issue (e.g. unreasonable distance)
 * - `not-found`   — expected element is missing entirely
 * - `skipped`     — rule was skipped because a prerequisite was not met
 * - `general`     — catch-all
 */
export type ErrorCategory =
  | "consistency"
  | "quality"
  | "not-found"
  | "skipped"
  | "general";

/** A single validation error produced by XSD or a business rule. */
export interface ValidationError {
  /** Human-readable error message. */
  message: string;
  /** Which subsystem produced this error. */
  source: ErrorSource;
  /** Severity level. */
  severity: ErrorSeverity;
  /** Error category (only meaningful for rule errors). */
  category: ErrorCategory;
  /** Name of the rule that produced this error (undefined for XSD errors). */
  rule?: string;
  /** 1-based line number in the source XML, if available. */
  line?: number;
  /** 1-based column number in the source XML, if available. */
  column?: number;
}

/** Validation result for a single file. */
export interface FileResult {
  /** File name (or path within an archive). */
  fileName: string;
  /** Detected Transmodel format. */
  format: TransmodelFormat;
  /** All errors found in this file. */
  errors: ValidationError[];
  /** Whether the file passed validation (zero errors). */
  passed: boolean;
  /**
   * Names of all rules/checks that were executed against this file.
   * Includes "xsd" if XSD validation was run. Used to derive which
   * rules passed (rulesRun minus rules that produced errors).
   */
  rulesRun: string[];
  /**
   * Wall-clock duration of each rule/check, in milliseconds.
   * Keys match entries in `rulesRun` (e.g. rule name or "xsd").
   */
  ruleTiming: Record<string, number>;
}

/** Aggregate validation result for an entire session. */
export interface ValidationResult {
  /** Results per file. */
  files: FileResult[];
  /** Total number of files validated. */
  totalFiles: number;
  /** Number of files that passed. */
  passedFiles: number;
  /** Number of files that failed. */
  failedFiles: number;
  /** Total number of errors across all files. */
  totalErrors: number;
  /** Wall-clock duration of the validation run, in milliseconds. */
  durationMs: number;
}

/** Configuration passed to a rule at runtime. */
export interface RuleConfig {
  /** Arbitrary key-value config (e.g. `{ distance: 500 }`). */
  [key: string]: unknown;
}

/** Metadata describing a business rule. */
export interface RuleDescriptor {
  /** Unique machine name, e.g. `"everyLineIsReferenced"`. */
  name: string;
  /** Short human-readable label for UI display, may contain inline markdown. */
  displayName: string;
  /** Human-readable description, may contain inline markdown. */
  description: string;
  /** Which format(s) this rule applies to. */
  formats: TransmodelFormat[];
}

/**
 * A business rule implementation.
 *
 * Rules receive a parsed XML document (as a string for now — will be
 * replaced with a proper DOM/XPath interface) and return an array of errors.
 */
export interface Rule extends RuleDescriptor {
  /**
   * Run this rule against one or more XML documents.
   *
   * @param documents - Array of `{ fileName, xml }` for all documents in the
   *   session. Most rules only inspect one document at a time, but cross-document
   *   rules (keyref, unique) need access to all of them.
   * @param config - Optional runtime configuration.
   * @returns Array of validation errors (empty = pass).
   */
  run(
    documents: DocumentInput[],
    config?: RuleConfig,
  ): Promise<ValidationError[]>;
}

/** Input document handed to rules. */
export interface DocumentInput {
  /** File name (or path within an archive). */
  fileName: string;
  /** Raw XML content. */
  xml: string;
}

/** Which XSD schema to use, identified by a registry key. */
export type SchemaId =
  // NeTEx
  | "netex@1.2-nc"
  | "netex@1.2"
  | "netex@1.2.2-nc"
  | "netex@1.2.2"
  | "netex@1.2.3-nc"
  | "netex@1.2.3"
  | "netex@1.3.0-nc"
  | "netex@1.3.0"
  | "netex@1.3.1-nc"
  | "netex@1.3.1"
  // EPIP
  | "epip@1.1.2"
  // SIRI
  | "siri@2.1"
  | "siri@2.2"
  // Custom (user-provided)
  | "custom";

/** A validation profile — a named combination of schema + rule selection. */
export interface Profile {
  /** Unique machine name, e.g. `"netex-fast-v1.2"`. */
  name: string;
  /** Human-readable display name. */
  displayName: string;
  /** Which format this profile targets. */
  format: TransmodelFormat;
  /** Which XSD schema to validate against (`undefined` = skip XSD). */
  schemaId?: SchemaId;
  /** Which rules are enabled by default (by rule name). Empty = no rules. */
  enabledRules: string[];
}

/** Options for the top-level `validate()` call. */
export interface ValidateOptions {
  /**
   * Override format detection. If `"auto"` (default), format is detected
   * from XML namespace.
   */
  format?: TransmodelFormat | "auto";

  /** Profile name to use. Overrides individual schema/rules if set. */
  profile?: string;

  /** Override the XSD schema to use (by registry key or `"custom"`). */
  schemaId?: SchemaId;

  /** Path to custom XSD schema (zip or directory). Only used when `schemaId` is `"custom"`. */
  customSchemaPath?: string;

  /** Explicit list of rule names to run. Overrides profile defaults. */
  rules?: string[];

  /** Per-rule configuration overrides. Key = rule name. */
  ruleConfig?: Record<string, RuleConfig>;

  /**
   * Skip XSD schema validation. When `true`, only business rules are run.
   * XSD content is still resolved for cross-document rules that need it.
   */
  skipXsd?: boolean;

  /**
   * Skip business rules. When `true`, only XSD schema validation is run.
   * Both per-document and cross-document rules are skipped.
   */
  skipRules?: boolean;

  /**
   * Progress callback invoked at each phase boundary during validation.
   * Useful for streaming progress to a client (e.g. via SSE).
   */
  onProgress?: (event: ProgressEvent) => void;
}

/** Phase of validation currently executing. */
export type ProgressPhase =
  | "xsd"
  | "rules"
  | "cross-doc"
  | "file-done"
  | "complete";

/** Progress event emitted by the validation engine. */
export interface ProgressEvent {
  /** Current phase. */
  phase: ProgressPhase;
  /** 0-based index of the file being processed (undefined for cross-doc / complete). */
  fileIndex?: number;
  /** Total number of files. */
  totalFiles: number;
  /** Name of the file being processed. */
  fileName?: string;
}
