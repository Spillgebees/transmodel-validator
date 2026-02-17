/**
 * Tests for the everyStopPlaceHasAName rule.
 *
 * Verifies that every StopPlace element has a Name or ShortName.
 */

import { describe, expect, it } from "vitest";

import { everyStopPlaceHasAName } from "./everyStopPlaceHasAName.js";
import { doc, netex, netexFlat } from "./testHelpers.js";

describe("everyStopPlaceHasAName", () => {
  it("passes when StopPlace has Name", async () => {
    const xml = netex(`
      <SiteFrame>
        <stopPlaces>
          <StopPlace id="SP1"><Name>Central Station</Name></StopPlace>
        </stopPlaces>
      </SiteFrame>
    `);
    const errors = await everyStopPlaceHasAName.run(doc(xml));
    expect(errors).toHaveLength(0);
  });

  it("passes when StopPlace has only ShortName", async () => {
    const xml = netex(`
      <SiteFrame>
        <stopPlaces>
          <StopPlace id="SP1"><ShortName>Central</ShortName></StopPlace>
        </stopPlaces>
      </SiteFrame>
    `);
    const errors = await everyStopPlaceHasAName.run(doc(xml));
    expect(errors).toHaveLength(0);
  });

  it("fails when StopPlace has no name", async () => {
    const xml = netex(`
      <SiteFrame>
        <stopPlaces>
          <StopPlace id="SP1"><StopPlaceType>busStation</StopPlaceType></StopPlace>
        </stopPlaces>
      </SiteFrame>
    `);
    const errors = await everyStopPlaceHasAName.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("SP1");
  });

  describe("flat-frame structure", () => {
    it("passes with flat SiteFrame", async () => {
      const xml = netexFlat(`
        <SiteFrame>
          <stopPlaces>
            <StopPlace id="SP1"><Name>Central Station</Name></StopPlace>
          </stopPlaces>
        </SiteFrame>
      `);
      const errors = await everyStopPlaceHasAName.run(doc(xml));
      expect(errors).toHaveLength(0);
    });

    it("fails with flat SiteFrame", async () => {
      const xml = netexFlat(`
        <SiteFrame>
          <stopPlaces>
            <StopPlace id="SP1"><StopPlaceType>busStation</StopPlaceType></StopPlace>
          </stopPlaces>
        </SiteFrame>
      `);
      const errors = await everyStopPlaceHasAName.run(doc(xml));
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("SP1");
    });
  });
});
