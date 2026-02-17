/**
 * @transmodel-validator/shared
 *
 * Shared types, constants, and utilities for the transmodel-validator project.
 * This package has zero runtime dependencies and is safe to import in browser bundles.
 */

// Descriptors
export {
  NETEX_RULE_DESCRIPTORS,
  NETEX_RULE_NAMES,
  SCHEMA_VERSIONS,
  type SchemaVersionDescriptor,
  SIRI_RULE_DESCRIPTORS,
  SIRI_RULE_NAMES,
} from "./descriptors.js";
// Format detection
export { detectFormat } from "./detect.js";
// Error factories
export {
  consistencyError,
  formatXsdMessage,
  generalError,
  notFoundError,
  qualityError,
  skippedInfo,
  xsdError,
} from "./errors.js";
// Types
export type {
  DocumentInput,
  ErrorCategory,
  ErrorSeverity,
  ErrorSource,
  FileResult,
  Profile,
  ProgressEvent,
  ProgressPhase,
  Rule,
  RuleConfig,
  RuleDescriptor,
  SchemaId,
  TransmodelFormat,
  ValidateOptions,
  ValidationError,
  ValidationResult,
} from "./types.js";
