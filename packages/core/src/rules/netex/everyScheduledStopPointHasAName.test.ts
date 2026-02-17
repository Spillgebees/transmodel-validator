/**
 * Tests for the everyScheduledStopPointHasAName rule.
 *
 * Verifies that every ScheduledStopPoint element has a Name.
 */

import { describe, expect, it } from "vitest";

import { everyScheduledStopPointHasAName } from "./everyScheduledStopPointHasAName.js";
import { doc, netex, netexFlat } from "./testHelpers.js";

describe("everyScheduledStopPointHasAName", () => {
  it("passes when ScheduledStopPoint has Name", async () => {
    const xml = netex(`
      <ServiceFrame>
        <scheduledStopPoints>
          <ScheduledStopPoint id="SSP1"><Name>Bus Stop A</Name></ScheduledStopPoint>
        </scheduledStopPoints>
      </ServiceFrame>
    `);
    const errors = await everyScheduledStopPointHasAName.run(doc(xml));
    expect(errors).toHaveLength(0);
  });

  it("fails when ScheduledStopPoint has no name", async () => {
    const xml = netex(`
      <ServiceFrame>
        <scheduledStopPoints>
          <ScheduledStopPoint id="SSP1"><Location /></ScheduledStopPoint>
        </scheduledStopPoints>
      </ServiceFrame>
    `);
    const errors = await everyScheduledStopPointHasAName.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("SSP1");
  });

  describe("flat-frame structure", () => {
    it("passes with flat ServiceFrame", async () => {
      const xml = netexFlat(`
        <ServiceFrame>
          <scheduledStopPoints>
            <ScheduledStopPoint id="SSP1"><Name>Bus Stop A</Name></ScheduledStopPoint>
          </scheduledStopPoints>
        </ServiceFrame>
      `);
      const errors = await everyScheduledStopPointHasAName.run(doc(xml));
      expect(errors).toHaveLength(0);
    });

    it("fails with flat ServiceFrame", async () => {
      const xml = netexFlat(`
        <ServiceFrame>
          <scheduledStopPoints>
            <ScheduledStopPoint id="SSP1"><Location /></ScheduledStopPoint>
          </scheduledStopPoints>
        </ServiceFrame>
      `);
      const errors = await everyScheduledStopPointHasAName.run(doc(xml));
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("SSP1");
    });
  });
});
