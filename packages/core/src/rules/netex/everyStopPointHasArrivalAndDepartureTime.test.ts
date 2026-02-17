/**
 * Tests for the everyStopPointHasArrivalAndDepartureTime rule.
 *
 * Verifies that intermediate stop points have both arrival and departure times,
 * and that first/last stops have the appropriate time.
 */

import { describe, expect, it } from "vitest";

import { everyStopPointHasArrivalAndDepartureTime } from "./everyStopPointHasArrivalAndDepartureTime.js";
import { doc, netex, netexFlat } from "./testHelpers.js";

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

  describe("flat-frame structure", () => {
    it("passes with flat TimetableFrame", async () => {
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
      const errors = await everyStopPointHasArrivalAndDepartureTime.run(
        doc(xml),
      );
      expect(errors).toHaveLength(0);
    });
  });
});
