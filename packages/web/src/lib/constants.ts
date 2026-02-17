/**
 * Client-safe constants for the web UI.
 *
 * Rule descriptors and schema versions are imported from
 * @transmodel-validator/shared — the single source of truth.
 * Web-specific constants (if any) are defined here.
 */

export type {
  RuleDescriptor,
  SchemaVersionDescriptor,
} from "@transmodel-validator/shared";
// Re-export shared constants that web components use.
export {
  NETEX_RULE_DESCRIPTORS,
  NETEX_RULE_NAMES,
  SCHEMA_VERSIONS,
  SIRI_RULE_DESCRIPTORS,
  SIRI_RULE_NAMES,
} from "@transmodel-validator/shared";
