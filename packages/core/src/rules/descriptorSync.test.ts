/**
 * Verifies that core's RULE_REGISTRY stays in sync with the shared
 * rule descriptors. Catches drift between rule implementations and
 * the shared metadata that the web UI and CLI display.
 */

import {
  NETEX_RULE_DESCRIPTORS,
  SIRI_RULE_DESCRIPTORS,
} from "@transmodel-validator/shared";
import { describe, expect, it } from "vitest";
import { RULE_REGISTRY } from "./registry.js";

describe("rule descriptor sync", () => {
  const allDescriptors = [...NETEX_RULE_DESCRIPTORS, ...SIRI_RULE_DESCRIPTORS];

  it("every descriptor has a matching rule in RULE_REGISTRY", () => {
    // arrange & act & assert
    for (const d of allDescriptors) {
      const rule = RULE_REGISTRY.get(d.name);
      expect(
        rule,
        `Descriptor "${d.name}" has no matching rule in RULE_REGISTRY`,
      ).toBeDefined();
    }
  });

  it("every rule in RULE_REGISTRY has a matching descriptor", () => {
    // arrange & act & assert
    for (const [name] of RULE_REGISTRY) {
      const descriptor = allDescriptors.find((d) => d.name === name);
      expect(
        descriptor,
        `Rule "${name}" has no matching descriptor in shared`,
      ).toBeDefined();
    }
  });

  it("rule metadata matches shared descriptors", () => {
    // arrange & act & assert
    for (const d of allDescriptors) {
      const rule = RULE_REGISTRY.get(d.name);
      if (!rule) continue;
      expect(rule.displayName).toBe(d.displayName);
      expect(rule.description).toBe(d.description);
      expect(rule.formats).toEqual(d.formats);
    }
  });
});
