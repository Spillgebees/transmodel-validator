/**
 * Tests for the passingTimesIsNotDecreasing rule.
 *
 * Verifies that passing times within a ServiceJourney are monotonically
 * non-decreasing.
 */

import { describe, expect, it } from "vitest";

import { passingTimesIsNotDecreasing } from "./passingTimesIsNotDecreasing.js";
import { doc, netex, netexFlat } from "./testHelpers.js";

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

  describe("flat-frame structure", () => {
    it("passes with flat TimetableFrame", async () => {
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

    it("fails with flat TimetableFrame", async () => {
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
  });
});
