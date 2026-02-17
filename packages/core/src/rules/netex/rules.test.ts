/**
 * Shared NeTEx rule tests (metadata, registry).
 *
 * Tests that apply to all registered NeTEx rules rather than individual rule logic.
 */

import { describe, expect, it } from "vitest";

import { RULE_REGISTRY } from "../registry.js";

describe("rule metadata", () => {
  const netexRules = [...RULE_REGISTRY.values()].filter((r) =>
    r.formats.includes("netex"),
  );

  it("every registered NeTEx rule has a non-empty displayName", () => {
    // act & assert
    expect(netexRules.length).toBeGreaterThan(0);
    for (const rule of netexRules) {
      expect(
        rule.displayName,
        `rule "${rule.name}" should have a non-empty displayName`,
      ).toBeTruthy();
      expect(
        rule.displayName.trim().length,
        `rule "${rule.name}" displayName should not be blank`,
      ).toBeGreaterThan(0);
    }
  });

  it("every registered NeTEx rule has a non-empty description", () => {
    // act & assert
    for (const rule of netexRules) {
      expect(
        rule.description,
        `rule "${rule.name}" should have a non-empty description`,
      ).toBeTruthy();
      expect(
        rule.description.trim().length,
        `rule "${rule.name}" description should not be blank`,
      ).toBeGreaterThan(0);
    }
  });

  it("displayName values are unique across all NeTEx rules", () => {
    // arrange
    const displayNames = netexRules.map((r) => r.displayName);

    // act & assert
    expect(new Set(displayNames).size).toBe(displayNames.length);
  });
});
