/**
 * Tests for the stopPlaceQuayDistanceIsReasonable rule.
 *
 * Verifies that Quay locations are within a reasonable distance
 * of their parent StopPlace centroid.
 */

import { describe, expect, it } from "vitest";

import { stopPlaceQuayDistanceIsReasonable } from "./stopPlaceQuayDistanceIsReasonable.js";
import { doc, netex, netexFlat } from "./testHelpers.js";

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

  describe("flat-frame structure", () => {
    it("passes with flat frames", async () => {
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

    it("fails with flat frames", async () => {
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
  });
});
