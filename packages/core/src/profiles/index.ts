/**
 * Predefined validation profiles.
 */

import type { Profile } from "@transmodel-validator/shared";
import {
  NETEX_RULE_NAMES,
  SIRI_RULE_NAMES,
} from "@transmodel-validator/shared";

// ── NeTEx profiles ──────────────────────────────────────────────────────

export const netexFast: Profile = {
  name: "netex-fast-v1.2",
  displayName: "netex-fast-v1.2",
  format: "netex",
  schemaId: "netex@1.2-nc",
  enabledRules: [...NETEX_RULE_NAMES],
};

export const netexFull: Profile = {
  name: "netex-full-v1.2",
  displayName: "netex-full-v1.2",
  format: "netex",
  schemaId: "netex@1.2",
  enabledRules: [...NETEX_RULE_NAMES],
};

export const epip: Profile = {
  name: "epip-v1.1.2",
  displayName: "epip-v1.1.2",
  format: "netex",
  schemaId: "epip@1.1.2",
  enabledRules: [...NETEX_RULE_NAMES],
};

export const netexSchemaOnly: Profile = {
  name: "netex-schema-only-v1.2",
  displayName: "netex-schema-only-v1.2",
  format: "netex",
  schemaId: "netex@1.2-nc",
  enabledRules: [],
};

export const netexRulesOnly: Profile = {
  name: "netex-rules-only",
  displayName: "netex-rules-only",
  format: "netex",
  schemaId: undefined, // Skip XSD validation
  enabledRules: [...NETEX_RULE_NAMES],
};

// ── SIRI profiles ───────────────────────────────────────────────────────

export const siri22: Profile = {
  name: "siri-v2.2",
  displayName: "siri-v2.2",
  format: "siri",
  schemaId: "siri@2.2",
  enabledRules: [...SIRI_RULE_NAMES], // Empty for now
};

export const siri21: Profile = {
  name: "siri-v2.1",
  displayName: "siri-v2.1",
  format: "siri",
  schemaId: "siri@2.1",
  enabledRules: [...SIRI_RULE_NAMES], // Empty for now
};

export const siriSchemaOnly: Profile = {
  name: "siri-schema-only-v2.2",
  displayName: "siri-schema-only-v2.2",
  format: "siri",
  schemaId: "siri@2.2",
  enabledRules: [],
};

export const siriRulesOnly: Profile = {
  name: "siri-rules-only",
  displayName: "siri-rules-only",
  format: "siri",
  schemaId: undefined, // Skip XSD validation
  enabledRules: [...SIRI_RULE_NAMES], // Empty for now
};

// ── Registry ────────────────────────────────────────────────────────────

/** All predefined profiles, keyed by name. */
export const PROFILE_REGISTRY: ReadonlyMap<string, Profile> = new Map([
  [netexFast.name, netexFast],
  [netexFull.name, netexFull],
  [epip.name, epip],
  [netexSchemaOnly.name, netexSchemaOnly],
  [netexRulesOnly.name, netexRulesOnly],
  [siri22.name, siri22],
  [siri21.name, siri21],
  [siriSchemaOnly.name, siriSchemaOnly],
  [siriRulesOnly.name, siriRulesOnly],
]);

/** Default profile per format. */
export const DEFAULT_PROFILE: Record<string, string> = {
  netex: "netex-fast-v1.2",
  siri: "siri-v2.2",
};

/** Get a profile by name. Throws if not found. */
export function getProfile(name: string): Profile {
  const profile = PROFILE_REGISTRY.get(name);
  if (!profile) {
    throw new Error(
      `Unknown profile: "${name}". Available: ${[...PROFILE_REGISTRY.keys()].join(", ")}`,
    );
  }
  return profile;
}
