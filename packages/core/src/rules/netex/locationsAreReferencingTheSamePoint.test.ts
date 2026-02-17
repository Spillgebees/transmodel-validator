/**
 * Tests for the locationsAreReferencingTheSamePoint rule.
 *
 * Verifies that StopPlace and ScheduledStopPoint locations linked
 * by PassengerStopAssignment are within a reasonable distance.
 */

import { describe, expect, it } from "vitest";

import type { DocumentInput } from "../../types.js";
import { locationsAreReferencingTheSamePoint } from "./locationsAreReferencingTheSamePoint.js";
import { doc, netex, netexFlat } from "./testHelpers.js";

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

  it("passes when assignment references StopPlace and ScheduledStopPoint in different files", async () => {
    // arrange
    const doc1: DocumentInput = {
      fileName: "stops.xml",
      xml: netex(`
        <SiteFrame id="SiF:stops" version="1">
          <stopPlaces>
            <StopPlace id="SP1">
              <Centroid><Location>
                <Longitude>10.0</Longitude>
                <Latitude>60.0</Latitude>
              </Location></Centroid>
            </StopPlace>
          </stopPlaces>
        </SiteFrame>
        <ServiceFrame id="SF:stops" version="1">
          <scheduledStopPoints>
            <ScheduledStopPoint id="SSP1">
              <Location>
                <Longitude>10.0001</Longitude>
                <Latitude>60.0</Latitude>
              </Location>
            </ScheduledStopPoint>
          </scheduledStopPoints>
        </ServiceFrame>
      `),
    };
    const doc2: DocumentInput = {
      fileName: "assignments.xml",
      xml: netex(`
        <ServiceFrame id="SF:assignments" version="1">
          <prerequisites>
            <SiteFrameRef ref="SiF:stops" version="1" />
            <ServiceFrameRef ref="SF:stops" version="1" />
          </prerequisites>
          <stopAssignments>
            <PassengerStopAssignment id="PSA1">
              <ScheduledStopPointRef ref="SSP1" />
              <StopPlaceRef ref="SP1" />
            </PassengerStopAssignment>
          </stopAssignments>
        </ServiceFrame>
      `),
    };

    // act
    const errors = await locationsAreReferencingTheSamePoint.run([doc1, doc2]);

    // assert
    expect(errors).toHaveLength(0);
  });

  it("fails when cross-file StopPlace and ScheduledStopPoint are too far apart", async () => {
    // arrange
    const doc1: DocumentInput = {
      fileName: "stops.xml",
      xml: netex(`
        <SiteFrame id="SiF:stops" version="1">
          <stopPlaces>
            <StopPlace id="SP1">
              <Centroid><Location>
                <Longitude>10.0</Longitude>
                <Latitude>60.0</Latitude>
              </Location></Centroid>
            </StopPlace>
          </stopPlaces>
        </SiteFrame>
        <ServiceFrame id="SF:stops" version="1">
          <scheduledStopPoints>
            <ScheduledStopPoint id="SSP1">
              <Location>
                <Longitude>10.1</Longitude>
                <Latitude>60.1</Latitude>
              </Location>
            </ScheduledStopPoint>
          </scheduledStopPoints>
        </ServiceFrame>
      `),
    };
    const doc2: DocumentInput = {
      fileName: "assignments.xml",
      xml: netex(`
        <ServiceFrame id="SF:assignments" version="1">
          <prerequisites>
            <SiteFrameRef ref="SiF:stops" version="1" />
            <ServiceFrameRef ref="SF:stops" version="1" />
          </prerequisites>
          <stopAssignments>
            <PassengerStopAssignment id="PSA1">
              <ScheduledStopPointRef ref="SSP1" />
              <StopPlaceRef ref="SP1" />
            </PassengerStopAssignment>
          </stopAssignments>
        </ServiceFrame>
      `),
    };

    // act
    const errors = await locationsAreReferencingTheSamePoint.run([doc1, doc2]);

    // assert
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("too far apart");
    expect(errors[0].fileName).toBe("assignments.xml");
  });

  describe("flat-frame structure", () => {
    it("passes with flat frames", async () => {
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

    it("fails with flat frames", async () => {
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
});
