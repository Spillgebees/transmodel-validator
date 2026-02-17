/**
 * Tests for the public validate API.
 *
 * These tests use "rules-only" profiles to avoid downloading XSD schemas.
 * XSD validation integration is tested separately (requires schema cache).
 */

import { describe, expect, it } from "vitest";

import { validateDocuments } from "./validate.js";

const VALID_NETEX = `<?xml version="1.0" encoding="UTF-8"?>
<PublicationDelivery xmlns="http://www.netex.org.uk/netex" version="1.0">
  <dataObjects>
    <CompositeFrame>
      <FrameDefaults>
        <DefaultLocale>
          <TimeZoneOffset>+1</TimeZoneOffset>
          <TimeZone>Europe/Oslo</TimeZone>
          <DefaultLanguage>no</DefaultLanguage>
        </DefaultLocale>
        <DefaultLocationSystem>EPSG:4326</DefaultLocationSystem>
      </FrameDefaults>
      <frames>
        <ServiceFrame>
          <lines>
            <Line id="L1"><Name>Bus 1</Name></Line>
          </lines>
          <routes>
            <Route><LineRef ref="L1" /></Route>
          </routes>
          <scheduledStopPoints>
            <ScheduledStopPoint id="SSP1"><Name>Stop A</Name></ScheduledStopPoint>
          </scheduledStopPoints>
          <stopAssignments>
            <PassengerStopAssignment id="PSA1">
              <ScheduledStopPointRef ref="SSP1" />
              <StopPlaceRef ref="SP1" />
            </PassengerStopAssignment>
          </stopAssignments>
        </ServiceFrame>
        <SiteFrame>
          <stopPlaces>
            <StopPlace id="SP1">
              <Name>Central Station</Name>
              <StopPlaceType>busStation</StopPlaceType>
              <Centroid><Location>
                <Longitude>10.0</Longitude>
                <Latitude>60.0</Latitude>
              </Location></Centroid>
            </StopPlace>
          </stopPlaces>
        </SiteFrame>
      </frames>
    </CompositeFrame>
  </dataObjects>
</PublicationDelivery>`;

const VALID_SIRI = `<?xml version="1.0" encoding="UTF-8"?>
<Siri xmlns="http://www.siri.org.uk/siri" version="2.1">
  <ServiceDelivery>
    <ResponseTimestamp>2025-01-01T12:00:00Z</ResponseTimestamp>
  </ServiceDelivery>
</Siri>`;

describe("validateDocuments", () => {
  it("validates a NeTEx document with business rules only", async () => {
    const result = await validateDocuments(
      [{ fileName: "test.xml", xml: VALID_NETEX }],
      { profile: "netex-rules-only" },
    );

    expect(result.totalFiles).toBe(1);
    expect(result.files[0].format).toBe("netex");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("validates a SIRI document (no rules, no XSD download)", async () => {
    const result = await validateDocuments(
      [{ fileName: "siri.xml", xml: VALID_SIRI }],
      { profile: "siri-rules-only" },
    );

    expect(result.totalFiles).toBe(1);
    expect(result.files[0].format).toBe("siri");
    // SIRI has no business rules yet, so it should pass.
    expect(result.files[0].passed).toBe(true);
    expect(result.totalErrors).toBe(0);
  });

  it("returns empty result for no documents", async () => {
    const result = await validateDocuments([]);
    expect(result.totalFiles).toBe(0);
    expect(result.passedFiles).toBe(0);
    expect(result.totalErrors).toBe(0);
  });

  it("allows overriding rules via options", async () => {
    const result = await validateDocuments(
      [{ fileName: "test.xml", xml: VALID_NETEX }],
      { profile: "netex-rules-only", rules: ["everyLineIsReferenced"] },
    );

    // Only everyLineIsReferenced should run — the doc should pass.
    expect(result.totalFiles).toBe(1);
    expect(result.files[0].passed).toBe(true);
  });

  it("detects errors in invalid documents", async () => {
    const badXml = `<?xml version="1.0" encoding="UTF-8"?>
<PublicationDelivery xmlns="http://www.netex.org.uk/netex" version="1.0">
  <dataObjects>
    <CompositeFrame>
      <frames>
        <ServiceFrame>
          <lines>
            <Line id="ORPHAN"><Name>No Reference</Name></Line>
          </lines>
        </ServiceFrame>
      </frames>
    </CompositeFrame>
  </dataObjects>
</PublicationDelivery>`;

    const result = await validateDocuments(
      [{ fileName: "bad.xml", xml: badXml }],
      { profile: "netex-rules-only", rules: ["everyLineIsReferenced"] },
    );

    expect(result.totalErrors).toBeGreaterThan(0);
    expect(result.files[0].passed).toBe(false);
    expect(result.files[0].errors[0].rule).toBe("everyLineIsReferenced");
  });

  it("respects format override", async () => {
    // Force SIRI processing — NeTEx rules won't match the SIRI format.
    const result = await validateDocuments(
      [{ fileName: "test.xml", xml: VALID_NETEX }],
      { format: "siri", profile: "siri-rules-only" },
    );

    // NeTEx rules won't run on a SIRI-formatted document.
    expect(result.files[0].format).toBe("siri");
    expect(result.files[0].passed).toBe(true);
  });
});
