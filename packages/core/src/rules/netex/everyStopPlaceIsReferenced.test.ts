/**
 * Tests for the everyStopPlaceIsReferenced rule.
 *
 * Verifies that every StopPlace element is referenced by at least one
 * StopPlaceRef in a PassengerStopAssignment.
 */

import type { DocumentInput } from "@transmodel-validator/shared";
import { describe, expect, it } from "vitest";
import { everyStopPlaceIsReferenced } from "./everyStopPlaceIsReferenced.js";
import { doc, netex, netexFlat } from "./testHelpers.js";

describe("everyStopPlaceIsReferenced", () => {
  it("passes when StopPlace is referenced", async () => {
    const xml = netex(`
      <SiteFrame>
        <stopPlaces>
          <StopPlace id="SP1"><Name>Test</Name></StopPlace>
        </stopPlaces>
      </SiteFrame>
      <ServiceFrame>
        <stopAssignments>
          <PassengerStopAssignment id="PSA1">
            <StopPlaceRef ref="SP1" />
          </PassengerStopAssignment>
        </stopAssignments>
      </ServiceFrame>
    `);
    const errors = await everyStopPlaceIsReferenced.run(doc(xml));
    expect(errors).toHaveLength(0);
  });

  it("fails when StopPlace has no reference", async () => {
    const xml = netex(`
      <SiteFrame>
        <stopPlaces>
          <StopPlace id="SP1"><Name>Test</Name></StopPlace>
        </stopPlaces>
      </SiteFrame>
    `);
    const errors = await everyStopPlaceIsReferenced.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("SP1");
  });

  it("passes when StopPlace is in one file and StopPlaceRef is in another", async () => {
    // arrange
    const doc1: DocumentInput = {
      fileName: "stops.xml",
      xml: netex(`
        <SiteFrame id="SiF:stops" version="1">
          <stopPlaces>
            <StopPlace id="SP1"><Name>Test</Name></StopPlace>
          </stopPlaces>
        </SiteFrame>
      `),
    };
    const doc2: DocumentInput = {
      fileName: "assignments.xml",
      xml: netex(`
        <ServiceFrame id="SF:assignments" version="1">
          <prerequisites>
            <SiteFrameRef ref="SiF:stops" version="1" />
          </prerequisites>
          <stopAssignments>
            <PassengerStopAssignment id="PSA1">
              <StopPlaceRef ref="SP1" />
            </PassengerStopAssignment>
          </stopAssignments>
        </ServiceFrame>
      `),
    };

    // act
    const errors = await everyStopPlaceIsReferenced.run([doc1, doc2]);

    // assert
    expect(errors).toHaveLength(0);
  });

  it("fails when StopPlace has no StopPlaceRef in any document", async () => {
    // arrange
    const doc1: DocumentInput = {
      fileName: "stops.xml",
      xml: netex(`
        <SiteFrame>
          <stopPlaces>
            <StopPlace id="SP1"><Name>Test</Name></StopPlace>
          </stopPlaces>
        </SiteFrame>
      `),
    };
    const doc2: DocumentInput = {
      fileName: "other.xml",
      xml: netex(`
        <ServiceFrame>
          <stopAssignments>
            <PassengerStopAssignment id="PSA1">
              <StopPlaceRef ref="SP99" />
            </PassengerStopAssignment>
          </stopAssignments>
        </ServiceFrame>
      `),
    };

    // act
    const errors = await everyStopPlaceIsReferenced.run([doc1, doc2]);

    // assert
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("SP1");
    expect(errors[0].fileName).toBe("stops.xml");
  });

  describe("flat-frame structure", () => {
    it("passes with flat frames", async () => {
      const xml = netexFlat(`
        <SiteFrame>
          <stopPlaces>
            <StopPlace id="SP1"><Name>Test</Name></StopPlace>
          </stopPlaces>
        </SiteFrame>
        <ServiceFrame>
          <stopAssignments>
            <PassengerStopAssignment id="PSA1">
              <StopPlaceRef ref="SP1" />
            </PassengerStopAssignment>
          </stopAssignments>
        </ServiceFrame>
      `);
      const errors = await everyStopPlaceIsReferenced.run(doc(xml));
      expect(errors).toHaveLength(0);
    });

    it("fails with flat frames", async () => {
      const xml = netexFlat(`
        <SiteFrame>
          <stopPlaces>
            <StopPlace id="SP1"><Name>Test</Name></StopPlace>
          </stopPlaces>
        </SiteFrame>
      `);
      const errors = await everyStopPlaceIsReferenced.run(doc(xml));
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("SP1");
    });
  });
});
