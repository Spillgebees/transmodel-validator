/**
 * @transmodel-validator/core
 *
 * Validation engine for NeTEx and SIRI XML files.
 * Validates against XSD schemas and business rules.
 *
 * Types, error factories, and format detection are provided by
 * `@transmodel-validator/shared` — import them from there.
 */

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
  RULE_REGISTRY,
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
// Public API
export { validate, validateDocuments } from "./validate.js";
