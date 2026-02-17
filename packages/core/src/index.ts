/**
 * @transmodel-validator/core
 *
 * Shared validation engine for NeTEx and SIRI XML files.
 * Validates against XSD schemas and business rules.
 */

// Format detection
export { detectFormat, type TransmodelFormat } from "./formats/detect.js";
// Logging
export { createLogger } from "./logger.js";
// Profiles
export {
  DEFAULT_PROFILE,
  getProfile,
  PROFILE_REGISTRY,
} from "./profiles/index.js";
// Rules
export {
  getRule,
  getRulesForFormat,
  NETEX_RULE_NAMES,
  RULE_REGISTRY,
  SIRI_RULE_NAMES,
} from "./rules/registry.js";
// Schema management
export {
  clearAllCaches,
  clearCache,
  ensureSchema,
  resolveEntryXsd,
} from "./schema/downloader.js";
export { SCHEMA_REGISTRY } from "./schema/registry.js";
// XSD validation
export {
  disposeValidatorCache,
  validateXsd,
  warmUpValidator,
} from "./schema/xsd-validator.js";
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
  ValidateOptions,
  ValidationError,
  ValidationResult,
} from "./types.js";
// Public API
export { validate, validateDocuments } from "./validate.js";
