/**
 * Tests for the netexPrerequisitesAreSatisfied rule.
 *
 * Validates that declared frame `<prerequisites>` are present and
 * recommends their use when cross-file references are detected
 * without corresponding prerequisite declarations.
 */

import { describe, expect, it } from "vitest";

import type { DocumentInput } from "../../types.js";
import { netexPrerequisitesAreSatisfied } from "./netexPrerequisitesAreSatisfied.js";
import { netex } from "./testHelpers.js";

describe("netexPrerequisitesAreSatisfied", () => {
  it("passes when all declared prerequisites are satisfied", async () => {
    // arrange
    const docA: DocumentInput = {
      fileName: "resources.xml",
      xml: netex(`
        <ResourceFrame id="RF:1" version="1">
          <organisations>
            <Operator id="OP1"><Name>Test</Name></Operator>
          </organisations>
        </ResourceFrame>
      `),
    };
    const docB: DocumentInput = {
      fileName: "services.xml",
      xml: netex(`
        <ServiceFrame id="SF:1" version="1">
          <prerequisites>
            <ResourceFrameRef ref="RF:1" />
          </prerequisites>
          <lines>
            <Line id="L1"><Name>Line 1</Name></Line>
          </lines>
        </ServiceFrame>
      `),
    };

    // act
    const errors = await netexPrerequisitesAreSatisfied.run([docA, docB]);

    // assert
    expect(errors).toHaveLength(0);
  });

  it("fails when a declared prerequisite is missing", async () => {
    // arrange
    const doc: DocumentInput = {
      fileName: "services.xml",
      xml: netex(`
        <ServiceFrame id="SF:1" version="1">
          <prerequisites>
            <ResourceFrameRef ref="RF:MISSING" />
          </prerequisites>
          <lines>
            <Line id="L1"><Name>Line 1</Name></Line>
          </lines>
        </ServiceFrame>
      `),
    };

    // act
    const errors = await netexPrerequisitesAreSatisfied.run([doc]);

    // assert
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("error");
    expect(errors[0].category).toBe("consistency");
    expect(errors[0].message).toContain("RF:MISSING");
    expect(errors[0].message).toContain("not present");
    expect(errors[0].fileName).toBe("services.xml");
  });

  it("warns when cross-file reference exists without prerequisites", async () => {
    // arrange
    const docA: DocumentInput = {
      fileName: "stops.xml",
      xml: netex(`
        <SiteFrame id="SiF:1" version="1">
          <stopPlaces>
            <StopPlace id="SP1"><Name>Central</Name></StopPlace>
          </stopPlaces>
        </SiteFrame>
      `),
    };
    const docB: DocumentInput = {
      fileName: "services.xml",
      xml: netex(`
        <ServiceFrame id="SF:1" version="1">
          <stopAssignments>
            <PassengerStopAssignment id="PSA1">
              <StopPlaceRef ref="SP1" />
            </PassengerStopAssignment>
          </stopAssignments>
        </ServiceFrame>
      `),
    };

    // act
    const errors = await netexPrerequisitesAreSatisfied.run([docA, docB]);

    // assert
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("warning");
    expect(errors[0].category).toBe("quality");
    expect(errors[0].message).toContain("services.xml");
    expect(errors[0].message).toContain("stops.xml");
    expect(errors[0].message).toContain("<prerequisites>");
    expect(errors[0].fileName).toBe("services.xml");
  });

  it("does not warn when cross-file reference is covered by prerequisites", async () => {
    // arrange
    const docA: DocumentInput = {
      fileName: "stops.xml",
      xml: netex(`
        <SiteFrame id="SiF:1" version="1">
          <stopPlaces>
            <StopPlace id="SP1"><Name>Central</Name></StopPlace>
          </stopPlaces>
        </SiteFrame>
      `),
    };
    const docB: DocumentInput = {
      fileName: "services.xml",
      xml: netex(`
        <ServiceFrame id="SF:1" version="1">
          <prerequisites>
            <SiteFrameRef ref="SiF:1" />
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
    const errors = await netexPrerequisitesAreSatisfied.run([docA, docB]);

    // assert
    expect(errors).toHaveLength(0);
  });

  it("deduplicates warnings per source-target file pair", async () => {
    // arrange
    const docA: DocumentInput = {
      fileName: "stops.xml",
      xml: netex(`
        <SiteFrame id="SiF:1" version="1">
          <stopPlaces>
            <StopPlace id="SP1"><Name>Central</Name></StopPlace>
            <StopPlace id="SP2"><Name>North</Name></StopPlace>
          </stopPlaces>
        </SiteFrame>
      `),
    };
    const docB: DocumentInput = {
      fileName: "services.xml",
      xml: netex(`
        <ServiceFrame id="SF:1" version="1">
          <stopAssignments>
            <PassengerStopAssignment id="PSA1">
              <StopPlaceRef ref="SP1" />
            </PassengerStopAssignment>
            <PassengerStopAssignment id="PSA2">
              <StopPlaceRef ref="SP2" />
            </PassengerStopAssignment>
          </stopAssignments>
        </ServiceFrame>
      `),
    };

    // act
    const errors = await netexPrerequisitesAreSatisfied.run([docA, docB]);

    // assert
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("warning");
  });

  it("does not warn for within-file references", async () => {
    // arrange
    const doc: DocumentInput = {
      fileName: "combined.xml",
      xml: netex(`
        <SiteFrame id="SiF:1" version="1">
          <stopPlaces>
            <StopPlace id="SP1"><Name>Central</Name></StopPlace>
          </stopPlaces>
        </SiteFrame>
        <ServiceFrame id="SF:1" version="1">
          <stopAssignments>
            <PassengerStopAssignment id="PSA1">
              <StopPlaceRef ref="SP1" />
            </PassengerStopAssignment>
          </stopAssignments>
        </ServiceFrame>
      `),
    };

    // act
    const errors = await netexPrerequisitesAreSatisfied.run([doc]);

    // assert
    expect(errors).toHaveLength(0);
  });

  it("passes when no frames have prerequisites and no cross-file references", async () => {
    // arrange
    const docA: DocumentInput = {
      fileName: "stops.xml",
      xml: netex(`
        <SiteFrame id="SiF:1" version="1">
          <stopPlaces>
            <StopPlace id="SP1"><Name>Central</Name></StopPlace>
          </stopPlaces>
        </SiteFrame>
      `),
    };
    const docB: DocumentInput = {
      fileName: "services.xml",
      xml: netex(`
        <ServiceFrame id="SF:1" version="1">
          <lines>
            <Line id="L1"><Name>Line 1</Name></Line>
          </lines>
        </ServiceFrame>
      `),
    };

    // act
    const errors = await netexPrerequisitesAreSatisfied.run([docA, docB]);

    // assert
    expect(errors).toHaveLength(0);
  });
});
