/**
 * Tests for NeTEx business rules.
 *
 * Uses minimal XML documents to test each rule in isolation.
 */

import { describe, expect, it } from "vitest";

import type { DocumentInput } from "../../types.js";
import { RULE_REGISTRY } from "../registry.js";
import { everyLineIsReferenced } from "./everyLineIsReferenced.js";
import { everyScheduledStopPointHasAName } from "./everyScheduledStopPointHasAName.js";
import { everyStopPlaceHasACorrectStopPlaceType } from "./everyStopPlaceHasACorrectStopPlaceType.js";
import { everyStopPlaceHasAName } from "./everyStopPlaceHasAName.js";
import { everyStopPlaceIsReferenced } from "./everyStopPlaceIsReferenced.js";
import { everyStopPointHasArrivalAndDepartureTime } from "./everyStopPointHasArrivalAndDepartureTime.js";
import { frameDefaultsHaveALocaleAndTimeZone } from "./frameDefaultsHaveALocaleAndTimeZone.js";
import { locationsAreReferencingTheSamePoint } from "./locationsAreReferencingTheSamePoint.js";
import { netexKeyRefConstraints } from "./netexKeyRefConstraints.js";
import { netexUniqueConstraints } from "./netexUniqueConstraints.js";
import { passingTimesIsNotDecreasing } from "./passingTimesIsNotDecreasing.js";
import { stopPlaceQuayDistanceIsReasonable } from "./stopPlaceQuayDistanceIsReasonable.js";

function doc(xml: string): DocumentInput[] {
  return [{ fileName: "test.xml", xml }];
}

/**
 * Wraps content in a minimal NeTEx PublicationDelivery with CompositeFrame.
 */
function netex(frames: string, frameDefaults = ""): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<PublicationDelivery xmlns="http://www.netex.org.uk/netex" version="1.0">
  <dataObjects>
    <CompositeFrame>
      ${frameDefaults ? `<FrameDefaults>${frameDefaults}</FrameDefaults>` : ""}
      <frames>
        ${frames}
      </frames>
    </CompositeFrame>
  </dataObjects>
</PublicationDelivery>`;
}

/**
 * Wraps content in a minimal NeTEx PublicationDelivery with flat frames
 * (no CompositeFrame wrapper). Frames are placed directly under dataObjects.
 */
function netexFlat(frames: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<PublicationDelivery xmlns="http://www.netex.org.uk/netex" version="1.0">
  <dataObjects>
    ${frames}
  </dataObjects>
</PublicationDelivery>`;
}

// =========================================================================
// everyLineIsReferenced
// =========================================================================

describe("everyLineIsReferenced", () => {
  it("passes when all Lines have LineRefs", async () => {
    const xml = netex(`
      <ServiceFrame>
        <lines>
          <Line id="L1"><Name>Bus 1</Name></Line>
        </lines>
        <routes>
          <Route><LineRef ref="L1" /></Route>
        </routes>
      </ServiceFrame>
    `);
    const errors = await everyLineIsReferenced.run(doc(xml));
    expect(errors).toHaveLength(0);
  });

  it("fails when a Line has no LineRef", async () => {
    const xml = netex(`
      <ServiceFrame>
        <lines>
          <Line id="L1"><Name>Bus 1</Name></Line>
          <Line id="L2"><Name>Bus 2</Name></Line>
        </lines>
        <routes>
          <Route><LineRef ref="L1" /></Route>
        </routes>
      </ServiceFrame>
    `);
    const errors = await everyLineIsReferenced.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("L2");
  });

  it("fails when a Line has no id", async () => {
    const xml = netex(`
      <ServiceFrame>
        <lines>
          <Line><Name>No ID</Name></Line>
        </lines>
      </ServiceFrame>
    `);
    const errors = await everyLineIsReferenced.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("missing attribute `@id`");
  });

  it("passes with no Lines (empty ServiceFrame)", async () => {
    const xml = netex(`<ServiceFrame><lines></lines></ServiceFrame>`);
    const errors = await everyLineIsReferenced.run(doc(xml));
    expect(errors).toHaveLength(0);
  });

  it("passes when Line is in one file and LineRef is in another", async () => {
    // arrange
    const doc1: DocumentInput = {
      fileName: "lines.xml",
      xml: netex(`
        <ServiceFrame id="SF:lines" version="1">
          <lines>
            <Line id="L1"><Name>Bus 1</Name></Line>
          </lines>
        </ServiceFrame>
      `),
    };
    const doc2: DocumentInput = {
      fileName: "routes.xml",
      xml: netex(`
        <ServiceFrame id="SF:routes" version="1">
          <prerequisites>
            <ServiceFrameRef ref="SF:lines" version="1" />
          </prerequisites>
          <routes>
            <Route><LineRef ref="L1" /></Route>
          </routes>
        </ServiceFrame>
      `),
    };

    // act
    const errors = await everyLineIsReferenced.run([doc1, doc2]);

    // assert
    expect(errors).toHaveLength(0);
  });

  it("fails when Line has no LineRef in any document", async () => {
    // arrange
    const doc1: DocumentInput = {
      fileName: "lines.xml",
      xml: netex(`
        <ServiceFrame>
          <lines>
            <Line id="L1"><Name>Bus 1</Name></Line>
          </lines>
        </ServiceFrame>
      `),
    };
    const doc2: DocumentInput = {
      fileName: "other.xml",
      xml: netex(`
        <ServiceFrame>
          <routes>
            <Route><LineRef ref="L99" /></Route>
          </routes>
        </ServiceFrame>
      `),
    };

    // act
    const errors = await everyLineIsReferenced.run([doc1, doc2]);

    // assert
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("L1");
    expect(errors[0].fileName).toBe("lines.xml");
  });
});

// =========================================================================
// everyStopPlaceHasAName
// =========================================================================

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
});

// =========================================================================
// everyStopPlaceHasACorrectStopPlaceType
// =========================================================================

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
});

// =========================================================================
// everyStopPlaceIsReferenced
// =========================================================================

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
});

// =========================================================================
// everyStopPointHasArrivalAndDepartureTime
// =========================================================================

describe("everyStopPointHasArrivalAndDepartureTime", () => {
  it("passes with correct arrival/departure times", async () => {
    const xml = netex(`
      <TimetableFrame>
        <vehicleJourneys>
          <ServiceJourney id="SJ1">
            <passingTimes>
              <TimetabledPassingTime id="TPT1">
                <DepartureTime>08:00:00</DepartureTime>
              </TimetabledPassingTime>
              <TimetabledPassingTime id="TPT2">
                <ArrivalTime>08:10:00</ArrivalTime>
                <DepartureTime>08:11:00</DepartureTime>
              </TimetabledPassingTime>
              <TimetabledPassingTime id="TPT3">
                <ArrivalTime>08:20:00</ArrivalTime>
              </TimetabledPassingTime>
            </passingTimes>
          </ServiceJourney>
        </vehicleJourneys>
      </TimetableFrame>
    `);
    const errors = await everyStopPointHasArrivalAndDepartureTime.run(doc(xml));
    expect(errors).toHaveLength(0);
  });

  it("fails when intermediate stop is missing departure", async () => {
    const xml = netex(`
      <TimetableFrame>
        <vehicleJourneys>
          <ServiceJourney id="SJ1">
            <passingTimes>
              <TimetabledPassingTime id="TPT1">
                <DepartureTime>08:00:00</DepartureTime>
              </TimetabledPassingTime>
              <TimetabledPassingTime id="TPT2">
                <ArrivalTime>08:10:00</ArrivalTime>
              </TimetabledPassingTime>
              <TimetabledPassingTime id="TPT3">
                <ArrivalTime>08:20:00</ArrivalTime>
              </TimetabledPassingTime>
            </passingTimes>
          </ServiceJourney>
        </vehicleJourneys>
      </TimetableFrame>
    `);
    const errors = await everyStopPointHasArrivalAndDepartureTime.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("departure time");
    expect(errors[0].message).toContain("TPT2");
  });

  it("reports correct line number for missing departure time in deeply nested document", async () => {
    // arrange
    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`, // line 1
      `<PublicationDelivery xmlns="http://www.netex.org.uk/netex" version="1.0">`, // line 2
      `  <dataObjects>`, // line 3
      `    <CompositeFrame>`, // line 4
      `      <frames>`, // line 5
      `        <TimetableFrame>`, // line 6
      `          <vehicleJourneys>`, // line 7
      `            <ServiceJourney id="SJ1">`, // line 8
      `              <passingTimes>`, // line 9
      `                <TimetabledPassingTime id="TPT1">`, // line 10
      `                  <DepartureTime>08:00:00</DepartureTime>`, // line 11
      `                </TimetabledPassingTime>`, // line 12
      `                <TimetabledPassingTime id="TPT2">`, // line 13
      `                  <ArrivalTime>08:10:00</ArrivalTime>`, // line 14
      `                </TimetabledPassingTime>`, // line 15
      `                <TimetabledPassingTime id="TPT3">`, // line 16
      `                  <ArrivalTime>08:20:00</ArrivalTime>`, // line 17
      `                </TimetabledPassingTime>`, // line 18
      `              </passingTimes>`, // line 19
      `            </ServiceJourney>`, // line 20
      `          </vehicleJourneys>`, // line 21
      `        </TimetableFrame>`, // line 22
      `      </frames>`, // line 23
      `    </CompositeFrame>`, // line 24
      `  </dataObjects>`, // line 25
      `</PublicationDelivery>`, // line 26
    ].join("\n");

    // act
    const errors = await everyStopPointHasArrivalAndDepartureTime.run(doc(xml));

    // assert
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("departure time");
    expect(errors[0].message).toContain("TPT2");
    expect(errors[0].line).toBe(13);
  });
});

// =========================================================================
// everyScheduledStopPointHasAName
// =========================================================================

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
});

// =========================================================================
// frameDefaultsHaveALocaleAndTimeZone
// =========================================================================

describe("frameDefaultsHaveALocaleAndTimeZone", () => {
  it("passes with valid locale settings", async () => {
    const xml = netex(
      `<ServiceFrame></ServiceFrame>`,
      `<DefaultLocale>
        <TimeZoneOffset>+1</TimeZoneOffset>
        <TimeZone>Europe/Oslo</TimeZone>
        <SummerTimeZoneOffset>+2</SummerTimeZoneOffset>
        <SummerTimeZone>Europe/Oslo</SummerTimeZone>
        <DefaultLanguage>no</DefaultLanguage>
      </DefaultLocale>`,
    );
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));
    expect(errors).toHaveLength(0);
  });

  it("passes with FrameDefaults but no DefaultLocale (optional)", async () => {
    const xml = netex(
      `<ServiceFrame></ServiceFrame>`,
      `<DefaultLocationSystem>EPSG:4326</DefaultLocationSystem>`,
    );
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));
    // DefaultLocale is optional — no error when it's absent.
    expect(errors).toHaveLength(0);
  });

  it("fails with invalid timezone offset", async () => {
    const xml = netex(
      `<ServiceFrame></ServiceFrame>`,
      `<DefaultLocale>
        <TimeZoneOffset>abc</TimeZoneOffset>
      </DefaultLocale>`,
    );
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("TimeZoneOffset");
  });

  it("fails with invalid language code", async () => {
    const xml = netex(
      `<ServiceFrame></ServiceFrame>`,
      `<DefaultLocale>
        <DefaultLanguage>zzz</DefaultLanguage>
      </DefaultLocale>`,
    );
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("DefaultLanguage");
  });

  it("passes when TimeZone is a common abbreviation (CET)", async () => {
    // arrange
    const xml = netex(
      `<ServiceFrame></ServiceFrame>`,
      `<DefaultLocale>
        <TimeZone>CET</TimeZone>
        <SummerTimeZone>CEST</SummerTimeZone>
      </DefaultLocale>`,
    );

    // act
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));

    // assert
    expect(errors).toHaveLength(0);
  });

  it("passes when TimeZone is UTC offset (UTC+1)", async () => {
    // arrange
    const xml = netex(
      `<ServiceFrame></ServiceFrame>`,
      `<DefaultLocale>
        <TimeZone>UTC+1</TimeZone>
      </DefaultLocale>`,
    );

    // act
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));

    // assert
    expect(errors).toHaveLength(0);
  });

  it("passes when TimeZone is GMT offset (GMT+01:00)", async () => {
    // arrange
    const xml = netex(
      `<ServiceFrame></ServiceFrame>`,
      `<DefaultLocale>
        <TimeZone>GMT+01:00</TimeZone>
      </DefaultLocale>`,
    );

    // act
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));

    // assert
    expect(errors).toHaveLength(0);
  });

  it("skips validation when TimeZone is empty string (falsy, treated as absent)", async () => {
    // arrange
    const xml = netex(
      `<ServiceFrame></ServiceFrame>`,
      `<DefaultLocale>
        <TimeZone></TimeZone>
      </DefaultLocale>`,
    );

    // act
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));

    // assert — empty string is falsy so the guard skips validation
    expect(errors).toHaveLength(0);
  });

  it("fails when TimeZone is random text", async () => {
    // arrange
    const xml = netex(
      `<ServiceFrame></ServiceFrame>`,
      `<DefaultLocale>
        <TimeZone>not a timezone</TimeZone>
      </DefaultLocale>`,
    );

    // act
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));

    // assert
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("TimeZone");
  });

  it("skips when FrameDefaults is missing (info severity)", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PublicationDelivery xmlns="http://www.netex.org.uk/netex" version="1.0">
  <dataObjects>
    <CompositeFrame>
      <frames><ServiceFrame></ServiceFrame></frames>
    </CompositeFrame>
  </dataObjects>
</PublicationDelivery>`;
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("info");
    expect(errors[0].category).toBe("skipped");
    expect(errors[0].message).toContain("Skipped");
  });

  it("reports correct line number for deeply nested invalid TimeZone", async () => {
    // arrange
    // NOTE: Each line is numbered explicitly so we can assert the exact line.
    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`, // line 1
      `<PublicationDelivery xmlns="http://www.netex.org.uk/netex" version="1.0">`, // line 2
      `  <dataObjects>`, // line 3
      `    <CompositeFrame>`, // line 4
      `      <FrameDefaults>`, // line 5
      `        <DefaultLocale>`, // line 6
      `          <TimeZone>INVALID_TZ</TimeZone>`, // line 7
      `          <DefaultLanguage>en</DefaultLanguage>`, // line 8
      `        </DefaultLocale>`, // line 9
      `      </FrameDefaults>`, // line 10
      `      <frames>`, // line 11
      `        <ServiceFrame></ServiceFrame>`, // line 12
      `      </frames>`, // line 13
      `    </CompositeFrame>`, // line 14
      `  </dataObjects>`, // line 15
      `</PublicationDelivery>`, // line 16
    ].join("\n");

    // act
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));

    // assert
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("TimeZone");
    expect(errors[0].line).toBe(6);
  });

  it("reports correct line number for invalid DefaultLanguage deep in document", async () => {
    // arrange
    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`, // line 1
      `<PublicationDelivery xmlns="http://www.netex.org.uk/netex" version="1.0">`, // line 2
      `  <dataObjects>`, // line 3
      `    <CompositeFrame>`, // line 4
      `      <FrameDefaults>`, // line 5
      `        <DefaultLocale>`, // line 6
      `          <TimeZoneOffset>+1</TimeZoneOffset>`, // line 7
      `          <TimeZone>Europe/Oslo</TimeZone>`, // line 8
      `          <SummerTimeZoneOffset>+2</SummerTimeZoneOffset>`, // line 9
      `          <SummerTimeZone>Europe/Oslo</SummerTimeZone>`, // line 10
      `          <DefaultLanguage>zzz</DefaultLanguage>`, // line 11
      `        </DefaultLocale>`, // line 12
      `      </FrameDefaults>`, // line 13
      `      <frames>`, // line 14
      `        <ServiceFrame></ServiceFrame>`, // line 15
      `      </frames>`, // line 16
      `    </CompositeFrame>`, // line 17
      `  </dataObjects>`, // line 18
      `</PublicationDelivery>`, // line 19
    ].join("\n");

    // act
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));

    // assert
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("DefaultLanguage");
    expect(errors[0].line).toBe(6);
  });
});

// =========================================================================
// stopPlaceQuayDistanceIsReasonable
// =========================================================================

describe("stopPlaceQuayDistanceIsReasonable", () => {
  it("passes when Quay is close to StopPlace", async () => {
    const xml = netex(
      `<SiteFrame>
        <stopPlaces>
          <StopPlace id="SP1">
            <Centroid><Location>
              <Longitude>10.0</Longitude>
              <Latitude>60.0</Latitude>
            </Location></Centroid>
            <quays>
              <Quay id="Q1">
                <Centroid><Location>
                  <Longitude>10.001</Longitude>
                  <Latitude>60.0</Latitude>
                </Location></Centroid>
              </Quay>
            </quays>
          </StopPlace>
        </stopPlaces>
      </SiteFrame>`,
      `<DefaultLocationSystem>EPSG:4326</DefaultLocationSystem>`,
    );
    const errors = await stopPlaceQuayDistanceIsReasonable.run(doc(xml));
    expect(errors).toHaveLength(0);
  });

  it("fails when Quay is far from StopPlace", async () => {
    const xml = netex(
      `<SiteFrame>
        <stopPlaces>
          <StopPlace id="SP1">
            <Centroid><Location>
              <Longitude>10.0</Longitude>
              <Latitude>60.0</Latitude>
            </Location></Centroid>
            <quays>
              <Quay id="Q1">
                <Centroid><Location>
                  <Longitude>10.1</Longitude>
                  <Latitude>60.1</Latitude>
                </Location></Centroid>
              </Quay>
            </quays>
          </StopPlace>
        </stopPlaces>
      </SiteFrame>`,
      `<DefaultLocationSystem>EPSG:4326</DefaultLocationSystem>`,
    );
    const errors = await stopPlaceQuayDistanceIsReasonable.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("exceeds **500m**");
    expect(errors[0].severity).toBe("warning"); // QualityError
  });

  it("skips when FrameDefaults is missing (info severity)", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PublicationDelivery xmlns="http://www.netex.org.uk/netex" version="1.0">
  <dataObjects>
    <CompositeFrame>
      <frames>
        <SiteFrame><stopPlaces>
          <StopPlace id="SP1">
            <Centroid><Location><Longitude>10.0</Longitude><Latitude>60.0</Latitude></Location></Centroid>
          </StopPlace>
        </stopPlaces></SiteFrame>
      </frames>
    </CompositeFrame>
  </dataObjects>
</PublicationDelivery>`;
    const errors = await stopPlaceQuayDistanceIsReasonable.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("info");
    expect(errors[0].category).toBe("skipped");
    expect(errors[0].message).toContain("Skipped");
  });

  it("skips when coordinate system is not WGS84 (info severity)", async () => {
    const xml = netex(
      `<SiteFrame><stopPlaces></stopPlaces></SiteFrame>`,
      `<DefaultLocationSystem>EPSG:3857</DefaultLocationSystem>`,
    );
    const errors = await stopPlaceQuayDistanceIsReasonable.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("info");
    expect(errors[0].category).toBe("skipped");
    expect(errors[0].message).toContain("Skipped");
  });

  it("reports correct line number for distant Quay in deeply nested document", async () => {
    // arrange
    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`, // line 1
      `<PublicationDelivery xmlns="http://www.netex.org.uk/netex" version="1.0">`, // line 2
      `  <dataObjects>`, // line 3
      `    <CompositeFrame>`, // line 4
      `      <FrameDefaults>`, // line 5
      `        <DefaultLocationSystem>EPSG:4326</DefaultLocationSystem>`, // line 6
      `      </FrameDefaults>`, // line 7
      `      <frames>`, // line 8
      `        <SiteFrame>`, // line 9
      `          <stopPlaces>`, // line 10
      `            <StopPlace id="SP1">`, // line 11
      `              <Centroid><Location>`, // line 12
      `                <Longitude>10.0</Longitude>`, // line 13
      `                <Latitude>60.0</Latitude>`, // line 14
      `              </Location></Centroid>`, // line 15
      `              <quays>`, // line 16
      `                <Quay id="Q1">`, // line 17
      `                  <Centroid><Location>`, // line 18
      `                    <Longitude>10.1</Longitude>`, // line 19
      `                    <Latitude>60.1</Latitude>`, // line 20
      `                  </Location></Centroid>`, // line 21
      `                </Quay>`, // line 22
      `              </quays>`, // line 23
      `            </StopPlace>`, // line 24
      `          </stopPlaces>`, // line 25
      `        </SiteFrame>`, // line 26
      `      </frames>`, // line 27
      `    </CompositeFrame>`, // line 28
      `  </dataObjects>`, // line 29
      `</PublicationDelivery>`, // line 30
    ].join("\n");

    // act
    const errors = await stopPlaceQuayDistanceIsReasonable.run(doc(xml));

    // assert
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("exceeds **500m**");
    expect(errors[0].line).toBe(11);
  });
});

// =========================================================================
// passingTimesIsNotDecreasing
// =========================================================================

describe("passingTimesIsNotDecreasing", () => {
  it("passes with increasing times", async () => {
    const xml = netex(`
      <TimetableFrame>
        <vehicleJourneys>
          <ServiceJourney id="SJ1">
            <passingTimes>
              <TimetabledPassingTime id="T1">
                <DepartureTime>08:00:00</DepartureTime>
              </TimetabledPassingTime>
              <TimetabledPassingTime id="T2">
                <ArrivalTime>08:10:00</ArrivalTime>
                <DepartureTime>08:11:00</DepartureTime>
              </TimetabledPassingTime>
              <TimetabledPassingTime id="T3">
                <ArrivalTime>08:20:00</ArrivalTime>
              </TimetabledPassingTime>
            </passingTimes>
          </ServiceJourney>
        </vehicleJourneys>
      </TimetableFrame>
    `);
    const errors = await passingTimesIsNotDecreasing.run(doc(xml));
    expect(errors).toHaveLength(0);
  });

  it("fails when time decreases", async () => {
    const xml = netex(`
      <TimetableFrame>
        <vehicleJourneys>
          <ServiceJourney id="SJ1">
            <passingTimes>
              <TimetabledPassingTime id="T1">
                <DepartureTime>08:30:00</DepartureTime>
              </TimetabledPassingTime>
              <TimetabledPassingTime id="T2">
                <ArrivalTime>08:10:00</ArrivalTime>
                <DepartureTime>08:11:00</DepartureTime>
              </TimetabledPassingTime>
            </passingTimes>
          </ServiceJourney>
        </vehicleJourneys>
      </TimetableFrame>
    `);
    const errors = await passingTimesIsNotDecreasing.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("decreased");
  });

  it("reports correct line number for decreasing time in deeply nested document", async () => {
    // arrange
    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`, // line 1
      `<PublicationDelivery xmlns="http://www.netex.org.uk/netex" version="1.0">`, // line 2
      `  <dataObjects>`, // line 3
      `    <CompositeFrame>`, // line 4
      `      <frames>`, // line 5
      `        <TimetableFrame>`, // line 6
      `          <vehicleJourneys>`, // line 7
      `            <ServiceJourney id="SJ1">`, // line 8
      `              <passingTimes>`, // line 9
      `                <TimetabledPassingTime id="T1">`, // line 10
      `                  <DepartureTime>08:30:00</DepartureTime>`, // line 11
      `                </TimetabledPassingTime>`, // line 12
      `                <TimetabledPassingTime id="T2">`, // line 13
      `                  <ArrivalTime>08:10:00</ArrivalTime>`, // line 14
      `                  <DepartureTime>08:11:00</DepartureTime>`, // line 15
      `                </TimetabledPassingTime>`, // line 16
      `              </passingTimes>`, // line 17
      `            </ServiceJourney>`, // line 18
      `          </vehicleJourneys>`, // line 19
      `        </TimetableFrame>`, // line 20
      `      </frames>`, // line 21
      `    </CompositeFrame>`, // line 22
      `  </dataObjects>`, // line 23
      `</PublicationDelivery>`, // line 24
    ].join("\n");

    // act
    const errors = await passingTimesIsNotDecreasing.run(doc(xml));

    // assert
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("decreased");
    expect(errors[0].line).toBe(13);
  });
});

// =========================================================================
// netexKeyRefConstraints
// =========================================================================

/**
 * Minimal XSD snippet with xsd:key and xsd:keyref definitions.
 * Defines a key on StopPlace/@id and a keyref from StopPlaceRef/@ref
 * pointing to it.
 */
const KEYREF_XSD = `
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:key name="StopPlaceIdKey">
    <xsd:selector xpath=".//StopPlace" />
    <xsd:field xpath="@id" />
  </xsd:key>
  <xsd:keyref name="StopPlaceIdRef" refer="StopPlaceIdKey">
    <xsd:selector xpath=".//StopPlaceRef" />
    <xsd:field xpath="@ref" />
  </xsd:keyref>
</xsd:schema>
`;

describe("netexKeyRefConstraints", () => {
  it("returns skippedInfo when no XSD content is provided", async () => {
    const xml = netex("<ServiceFrame />");
    const errors = await netexKeyRefConstraints.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("info");
    expect(errors[0].category).toBe("skipped");
  });

  it("passes when all keyrefs resolve to existing keys", async () => {
    const xml = `<root>
      <StopPlace id="SP1" />
      <StopPlace id="SP2" />
      <StopPlaceRef ref="SP1" />
      <StopPlaceRef ref="SP2" />
    </root>`;
    const errors = await netexKeyRefConstraints.run(
      [{ fileName: "test.xml", xml }],
      { xsdContent: KEYREF_XSD },
    );
    expect(errors).toHaveLength(0);
  });

  it("fails when a keyref points to a missing key", async () => {
    const xml = `<root>
      <StopPlace id="SP1" />
      <StopPlaceRef ref="SP1" />
      <StopPlaceRef ref="SP_MISSING" />
    </root>`;
    const errors = await netexKeyRefConstraints.run(
      [{ fileName: "test.xml", xml }],
      { xsdContent: KEYREF_XSD },
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("error");
    expect(errors[0].category).toBe("consistency");
    expect(errors[0].message).toContain("SP_MISSING");
  });

  it("resolves keyrefs across multiple documents", async () => {
    const doc1 = {
      fileName: "a.xml",
      xml: `<root><StopPlace id="SP1" /></root>`,
    };
    const doc2 = {
      fileName: "b.xml",
      xml: `<root><StopPlaceRef ref="SP1" /></root>`,
    };
    const errors = await netexKeyRefConstraints.run([doc1, doc2], {
      xsdContent: KEYREF_XSD,
    });
    expect(errors).toHaveLength(0);
  });

  it("fails for cross-doc ref pointing to missing key", async () => {
    const doc1 = {
      fileName: "a.xml",
      xml: `<root><StopPlace id="SP1" /></root>`,
    };
    const doc2 = {
      fileName: "b.xml",
      xml: `<root><StopPlaceRef ref="SP999" /></root>`,
    };
    const errors = await netexKeyRefConstraints.run([doc1, doc2], {
      xsdContent: KEYREF_XSD,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("SP999");
  });

  it("skips elements with versionRef attribute", async () => {
    const xml = `<root>
      <StopPlace id="SP1" />
      <StopPlaceRef ref="SP_MISSING" versionRef="1" />
    </root>`;
    const errors = await netexKeyRefConstraints.run(
      [{ fileName: "test.xml", xml }],
      { xsdContent: KEYREF_XSD },
    );
    expect(errors).toHaveLength(0);
  });

  it("skips refs where all fields are empty", async () => {
    const xml = `<root>
      <StopPlace id="SP1" />
      <StopPlaceRef />
    </root>`;
    const errors = await netexKeyRefConstraints.run(
      [{ fileName: "test.xml", xml }],
      { xsdContent: KEYREF_XSD },
    );
    expect(errors).toHaveLength(0);
  });
});

// =========================================================================
// netexUniqueConstraints
// =========================================================================

/**
 * Minimal XSD snippet with an xsd:unique constraint.
 * Enforces uniqueness of StopPlace/@id.
 */
const UNIQUE_XSD = `
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:unique name="UniqueStopPlaceId">
    <xsd:selector xpath=".//StopPlace" />
    <xsd:field xpath="@id" />
  </xsd:unique>
</xsd:schema>
`;

describe("netexUniqueConstraints", () => {
  it("returns skippedInfo when no XSD content is provided", async () => {
    const xml = netex("<ServiceFrame />");
    const errors = await netexUniqueConstraints.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("info");
    expect(errors[0].category).toBe("skipped");
  });

  it("passes when all values are unique", async () => {
    const xml = `<root>
      <StopPlace id="SP1" />
      <StopPlace id="SP2" />
      <StopPlace id="SP3" />
    </root>`;
    const errors = await netexUniqueConstraints.run(
      [{ fileName: "test.xml", xml }],
      { xsdContent: UNIQUE_XSD },
    );
    expect(errors).toHaveLength(0);
  });

  it("fails when duplicate values exist within a single document", async () => {
    const xml = `<root>
      <StopPlace id="SP1" />
      <StopPlace id="SP1" />
    </root>`;
    const errors = await netexUniqueConstraints.run(
      [{ fileName: "test.xml", xml }],
      { xsdContent: UNIQUE_XSD },
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("error");
    expect(errors[0].category).toBe("consistency");
    expect(errors[0].message).toContain("UniqueStopPlaceId");
  });

  it("allows identical elements across documents (per-document scoping)", async () => {
    // arrange
    const doc1 = {
      fileName: "a.xml",
      xml: `<root><StopPlace id="SP1" /></root>`,
    };
    const doc2 = {
      fileName: "b.xml",
      xml: `<root><StopPlace id="SP1" /></root>`,
    };

    // act
    const errors = await netexUniqueConstraints.run([doc1, doc2], {
      xsdContent: UNIQUE_XSD,
    });

    // assert — per W3C XSD §3.11.4, unique constraints are scoped to the
    // declaring element (PublicationDelivery), so cross-document duplicates
    // are allowed.
    expect(errors).toHaveLength(0);
  });

  it("fails when duplicate values exist within a single document (multi-doc input)", async () => {
    // arrange
    const doc1 = {
      fileName: "a.xml",
      xml: `<root><StopPlace id="SP1" /><StopPlace id="SP1" /></root>`,
    };
    const doc2 = {
      fileName: "b.xml",
      xml: `<root><StopPlace id="SP2" /></root>`,
    };

    // act
    const errors = await netexUniqueConstraints.run([doc1, doc2], {
      xsdContent: UNIQUE_XSD,
    });

    // assert — only the within-document duplicate in doc1 is flagged
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("UniqueStopPlaceId");
  });

  it("passes when different documents have different IDs", async () => {
    const doc1 = {
      fileName: "a.xml",
      xml: `<root><StopPlace id="SP1" /></root>`,
    };
    const doc2 = {
      fileName: "b.xml",
      xml: `<root><StopPlace id="SP2" /></root>`,
    };
    const errors = await netexUniqueConstraints.run([doc1, doc2], {
      xsdContent: UNIQUE_XSD,
    });
    expect(errors).toHaveLength(0);
  });
});

// =========================================================================
// locationsAreReferencingTheSamePoint
// =========================================================================

describe("locationsAreReferencingTheSamePoint", () => {
  it("passes when StopPlace and ScheduledStopPoint are close", async () => {
    const xml = netex(`
      <SiteFrame>
        <stopPlaces>
          <StopPlace id="SP1">
            <Centroid><Location>
              <Longitude>10.0</Longitude>
              <Latitude>60.0</Latitude>
            </Location></Centroid>
          </StopPlace>
        </stopPlaces>
      </SiteFrame>
      <ServiceFrame>
        <scheduledStopPoints>
          <ScheduledStopPoint id="SSP1">
            <Location>
              <Longitude>10.0001</Longitude>
              <Latitude>60.0</Latitude>
            </Location>
          </ScheduledStopPoint>
        </scheduledStopPoints>
        <stopAssignments>
          <PassengerStopAssignment id="PSA1">
            <ScheduledStopPointRef ref="SSP1" />
            <StopPlaceRef ref="SP1" />
          </PassengerStopAssignment>
        </stopAssignments>
      </ServiceFrame>
    `);
    const errors = await locationsAreReferencingTheSamePoint.run(doc(xml));
    expect(errors).toHaveLength(0);
  });

  it("fails when StopPlace and ScheduledStopPoint are far apart", async () => {
    const xml = netex(`
      <SiteFrame>
        <stopPlaces>
          <StopPlace id="SP1">
            <Centroid><Location>
              <Longitude>10.0</Longitude>
              <Latitude>60.0</Latitude>
            </Location></Centroid>
          </StopPlace>
        </stopPlaces>
      </SiteFrame>
      <ServiceFrame>
        <scheduledStopPoints>
          <ScheduledStopPoint id="SSP1">
            <Location>
              <Longitude>10.1</Longitude>
              <Latitude>60.1</Latitude>
            </Location>
          </ScheduledStopPoint>
        </scheduledStopPoints>
        <stopAssignments>
          <PassengerStopAssignment id="PSA1">
            <ScheduledStopPointRef ref="SSP1" />
            <StopPlaceRef ref="SP1" />
          </PassengerStopAssignment>
        </stopAssignments>
      </ServiceFrame>
    `);
    const errors = await locationsAreReferencingTheSamePoint.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("too far apart");
  });

  it("fails when referenced ScheduledStopPoint is missing", async () => {
    const xml = netex(`
      <ServiceFrame>
        <stopAssignments>
          <PassengerStopAssignment id="PSA1">
            <ScheduledStopPointRef ref="SSP_MISSING" />
            <StopPlaceRef ref="SP1" />
          </PassengerStopAssignment>
        </stopAssignments>
      </ServiceFrame>
    `);
    const errors = await locationsAreReferencingTheSamePoint.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("ScheduledStopPoint");
  });

  it("fails when referenced StopPlace is missing", async () => {
    const xml = netex(`
      <ServiceFrame>
        <scheduledStopPoints>
          <ScheduledStopPoint id="SSP1">
            <Location>
              <Longitude>10.0</Longitude>
              <Latitude>60.0</Latitude>
            </Location>
          </ScheduledStopPoint>
        </scheduledStopPoints>
        <stopAssignments>
          <PassengerStopAssignment id="PSA1">
            <ScheduledStopPointRef ref="SSP1" />
            <StopPlaceRef ref="SP_MISSING" />
          </PassengerStopAssignment>
        </stopAssignments>
      </ServiceFrame>
    `);
    const errors = await locationsAreReferencingTheSamePoint.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("StopPlace");
  });
});

// =========================================================================
// Flat-frame structure tests
// =========================================================================

describe("flat-frame structure (no CompositeFrame)", () => {
  it("everyLineIsReferenced: passes with flat ServiceFrame", async () => {
    const xml = netexFlat(`
      <ServiceFrame>
        <lines>
          <Line id="L1"><Name>Bus 1</Name></Line>
        </lines>
        <routes>
          <Route><LineRef ref="L1" /></Route>
        </routes>
      </ServiceFrame>
    `);
    const errors = await everyLineIsReferenced.run(doc(xml));
    expect(errors).toHaveLength(0);
  });

  it("everyLineIsReferenced: fails with flat ServiceFrame", async () => {
    const xml = netexFlat(`
      <ServiceFrame>
        <lines>
          <Line id="L1"><Name>Bus 1</Name></Line>
        </lines>
      </ServiceFrame>
    `);
    const errors = await everyLineIsReferenced.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("L1");
  });

  it("everyStopPlaceHasAName: passes with flat SiteFrame", async () => {
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

  it("everyStopPlaceHasAName: fails with flat SiteFrame", async () => {
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

  it("everyStopPlaceHasACorrectStopPlaceType: passes with flat SiteFrame", async () => {
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

  it("everyStopPlaceIsReferenced: passes with flat frames", async () => {
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

  it("everyStopPlaceIsReferenced: fails with flat frames", async () => {
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

  it("everyScheduledStopPointHasAName: passes with flat ServiceFrame", async () => {
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

  it("everyScheduledStopPointHasAName: fails with flat ServiceFrame", async () => {
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

  it("passingTimesIsNotDecreasing: passes with flat TimetableFrame", async () => {
    const xml = netexFlat(`
      <TimetableFrame>
        <vehicleJourneys>
          <ServiceJourney id="SJ1">
            <passingTimes>
              <TimetabledPassingTime id="T1">
                <DepartureTime>08:00:00</DepartureTime>
              </TimetabledPassingTime>
              <TimetabledPassingTime id="T2">
                <ArrivalTime>08:10:00</ArrivalTime>
              </TimetabledPassingTime>
            </passingTimes>
          </ServiceJourney>
        </vehicleJourneys>
      </TimetableFrame>
    `);
    const errors = await passingTimesIsNotDecreasing.run(doc(xml));
    expect(errors).toHaveLength(0);
  });

  it("passingTimesIsNotDecreasing: fails with flat TimetableFrame", async () => {
    const xml = netexFlat(`
      <TimetableFrame>
        <vehicleJourneys>
          <ServiceJourney id="SJ1">
            <passingTimes>
              <TimetabledPassingTime id="T1">
                <DepartureTime>08:30:00</DepartureTime>
              </TimetabledPassingTime>
              <TimetabledPassingTime id="T2">
                <ArrivalTime>08:10:00</ArrivalTime>
              </TimetabledPassingTime>
            </passingTimes>
          </ServiceJourney>
        </vehicleJourneys>
      </TimetableFrame>
    `);
    const errors = await passingTimesIsNotDecreasing.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("decreased");
  });

  it("everyStopPointHasArrivalAndDepartureTime: passes with flat TimetableFrame", async () => {
    const xml = netexFlat(`
      <TimetableFrame>
        <vehicleJourneys>
          <ServiceJourney id="SJ1">
            <passingTimes>
              <TimetabledPassingTime id="TPT1">
                <DepartureTime>08:00:00</DepartureTime>
              </TimetabledPassingTime>
              <TimetabledPassingTime id="TPT2">
                <ArrivalTime>08:10:00</ArrivalTime>
                <DepartureTime>08:11:00</DepartureTime>
              </TimetabledPassingTime>
              <TimetabledPassingTime id="TPT3">
                <ArrivalTime>08:20:00</ArrivalTime>
              </TimetabledPassingTime>
            </passingTimes>
          </ServiceJourney>
        </vehicleJourneys>
      </TimetableFrame>
    `);
    const errors = await everyStopPointHasArrivalAndDepartureTime.run(doc(xml));
    expect(errors).toHaveLength(0);
  });

  it("frameDefaultsHaveALocaleAndTimeZone: passes with flat ResourceFrame", async () => {
    const xml = netexFlat(`
      <ResourceFrame>
        <FrameDefaults>
          <DefaultLocale>
            <TimeZoneOffset>+1</TimeZoneOffset>
            <TimeZone>Europe/Oslo</TimeZone>
            <DefaultLanguage>no</DefaultLanguage>
          </DefaultLocale>
        </FrameDefaults>
      </ResourceFrame>
    `);
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));
    expect(errors).toHaveLength(0);
  });

  it("frameDefaultsHaveALocaleAndTimeZone: fails with flat ServiceFrame", async () => {
    const xml = netexFlat(`
      <ServiceFrame>
        <FrameDefaults>
          <DefaultLocale>
            <TimeZoneOffset>abc</TimeZoneOffset>
          </DefaultLocale>
        </FrameDefaults>
      </ServiceFrame>
    `);
    const errors = await frameDefaultsHaveALocaleAndTimeZone.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("TimeZoneOffset");
  });

  it("stopPlaceQuayDistanceIsReasonable: passes with flat frames", async () => {
    const xml = netexFlat(`
      <ResourceFrame>
        <FrameDefaults>
          <DefaultLocationSystem>EPSG:4326</DefaultLocationSystem>
        </FrameDefaults>
      </ResourceFrame>
      <SiteFrame>
        <stopPlaces>
          <StopPlace id="SP1">
            <Centroid><Location>
              <Longitude>10.0</Longitude>
              <Latitude>60.0</Latitude>
            </Location></Centroid>
            <quays>
              <Quay id="Q1">
                <Centroid><Location>
                  <Longitude>10.001</Longitude>
                  <Latitude>60.0</Latitude>
                </Location></Centroid>
              </Quay>
            </quays>
          </StopPlace>
        </stopPlaces>
      </SiteFrame>
    `);
    const errors = await stopPlaceQuayDistanceIsReasonable.run(doc(xml));
    expect(errors).toHaveLength(0);
  });

  it("stopPlaceQuayDistanceIsReasonable: fails with flat frames", async () => {
    const xml = netexFlat(`
      <ResourceFrame>
        <FrameDefaults>
          <DefaultLocationSystem>EPSG:4326</DefaultLocationSystem>
        </FrameDefaults>
      </ResourceFrame>
      <SiteFrame>
        <stopPlaces>
          <StopPlace id="SP1">
            <Centroid><Location>
              <Longitude>10.0</Longitude>
              <Latitude>60.0</Latitude>
            </Location></Centroid>
            <quays>
              <Quay id="Q1">
                <Centroid><Location>
                  <Longitude>10.1</Longitude>
                  <Latitude>60.1</Latitude>
                </Location></Centroid>
              </Quay>
            </quays>
          </StopPlace>
        </stopPlaces>
      </SiteFrame>
    `);
    const errors = await stopPlaceQuayDistanceIsReasonable.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("exceeds **500m**");
  });

  it("locationsAreReferencingTheSamePoint: passes with flat frames", async () => {
    const xml = netexFlat(`
      <SiteFrame>
        <stopPlaces>
          <StopPlace id="SP1">
            <Centroid><Location>
              <Longitude>10.0</Longitude>
              <Latitude>60.0</Latitude>
            </Location></Centroid>
          </StopPlace>
        </stopPlaces>
      </SiteFrame>
      <ServiceFrame>
        <scheduledStopPoints>
          <ScheduledStopPoint id="SSP1">
            <Location>
              <Longitude>10.0001</Longitude>
              <Latitude>60.0</Latitude>
            </Location>
          </ScheduledStopPoint>
        </scheduledStopPoints>
        <stopAssignments>
          <PassengerStopAssignment id="PSA1">
            <ScheduledStopPointRef ref="SSP1" />
            <StopPlaceRef ref="SP1" />
          </PassengerStopAssignment>
        </stopAssignments>
      </ServiceFrame>
    `);
    const errors = await locationsAreReferencingTheSamePoint.run(doc(xml));
    expect(errors).toHaveLength(0);
  });

  it("locationsAreReferencingTheSamePoint: fails with flat frames", async () => {
    const xml = netexFlat(`
      <SiteFrame>
        <stopPlaces>
          <StopPlace id="SP1">
            <Centroid><Location>
              <Longitude>10.0</Longitude>
              <Latitude>60.0</Latitude>
            </Location></Centroid>
          </StopPlace>
        </stopPlaces>
      </SiteFrame>
      <ServiceFrame>
        <scheduledStopPoints>
          <ScheduledStopPoint id="SSP1">
            <Location>
              <Longitude>10.1</Longitude>
              <Latitude>60.1</Latitude>
            </Location>
          </ScheduledStopPoint>
        </scheduledStopPoints>
        <stopAssignments>
          <PassengerStopAssignment id="PSA1">
            <ScheduledStopPointRef ref="SSP1" />
            <StopPlaceRef ref="SP1" />
          </PassengerStopAssignment>
        </stopAssignments>
      </ServiceFrame>
    `);
    const errors = await locationsAreReferencingTheSamePoint.run(doc(xml));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("too far apart");
  });
});

// =========================================================================
// Rule metadata
// =========================================================================

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
