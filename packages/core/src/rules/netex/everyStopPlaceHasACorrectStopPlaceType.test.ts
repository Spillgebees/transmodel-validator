/**
 * Tests for the everyStopPlaceHasACorrectStopPlaceType rule.
 *
 * Verifies that every StopPlace has a valid StopPlaceType value.
 */

import { describe, expect, it } from "vitest";

import { everyStopPlaceHasACorrectStopPlaceType } from "./everyStopPlaceHasACorrectStopPlaceType.js";
import { doc, netex, netexFlat } from "./testHelpers.js";

describe("everyStopPlaceHasACorrectStopPlaceType", () => {
  it("passes with valid StopPlaceType", async () => {
    const xml = netex(`
      <SiteFrame>
        <stopPlaces>
          <StopPlace id="SP1"><StopPlaceType>busStation</StopPlaceType></StopPlace>
          <StopPlace id="SP2"><StopPlaceType>railStation</StopPlaceType></StopPlace>
        </stopPlaces>
      </SiteFrame>
    `);
    const errors = await everyStopPlaceHasACorrectStopPlaceType.run(doc(xml));
    expect(errors).toHaveLength(0);
  });

  it("fails with invalid StopPlaceType", async () => {
    const xml = netex(`
      <SiteFrame>
        <stopPlaces>
          <StopPlace id="SP1"><StopPlaceType>invalidType</StopPlaceType></StopPlace>
        </stopPlaces>
      </SiteFrame>
    `);
    const errors = await everyStopPlaceHasACorrectStopPlaceType.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("not valid");
  });

  it("fails with missing StopPlaceType", async () => {
    const xml = netex(`
      <SiteFrame>
        <stopPlaces>
          <StopPlace id="SP1"><Name>Test</Name></StopPlace>
        </stopPlaces>
      </SiteFrame>
    `);
    const errors = await everyStopPlaceHasACorrectStopPlaceType.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("not set");
  });

  describe("flat-frame structure", () => {
    it("passes with flat SiteFrame", async () => {
      const xml = netexFlat(`
        <SiteFrame>
          <stopPlaces>
            <StopPlace id="SP1"><StopPlaceType>busStation</StopPlaceType></StopPlace>
          </stopPlaces>
        </SiteFrame>
      `);
      const errors = await everyStopPlaceHasACorrectStopPlaceType.run(doc(xml));
      expect(errors).toHaveLength(0);
    });
  });
});
