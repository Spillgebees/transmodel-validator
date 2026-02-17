/**
 * Rule: passingTimesIsNotDecreasing
 *
 * For each ServiceJourney, checks that passing times (Arrival/Departure)
 * do not decrease between consecutive stops. Also validates that
 * ArrivalDayOffset and DepartureDayOffset don't decrease.
 */

import { consistencyError } from "../../errors.js";
import type { DocumentInput, Rule, ValidationError } from "../../types.js";
import { findChildren, getAttr, getChildText } from "../../xml/helpers.js";
import { findNeTExElements, SERVICE_JOURNEYS } from "../../xml/paths.js";

const RULE_NAME = "passingTimesIsNotDecreasing";

export const passingTimesIsNotDecreasing: Rule = {
  name: RULE_NAME,
  displayName: "Passing time order",
  description:
    "Passing times in a `ServiceJourney` must not decrease between consecutive stops.",
  formats: ["netex"],

  async run(documents: DocumentInput[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const doc of documents) {
      const journeys = findNeTExElements(doc.xml, SERVICE_JOURNEYS);

      for (const journey of journeys) {
        const journeyId = getAttr(journey.openTag, "id");

        const containers = findChildren(journey.innerXml, "passingTimes");
        for (const container of containers) {
          const passingTimes = findChildren(
            container.innerXml,
            "TimetabledPassingTime",
          );

          let prevDepartureTime: string | undefined;
          let prevArrivalDayOffset: string | undefined;
          let prevDepartureDayOffset: string | undefined;

          for (let i = 0; i < passingTimes.length; i++) {
            const pt = passingTimes[i];
            const ptId = getAttr(pt.openTag, "id");

            const arrivalTime = getChildText(pt.innerXml, "ArrivalTime");
            const arrivalDayOffset = getChildText(
              pt.innerXml,
              "ArrivalDayOffset",
            );
            const departureTime = getChildText(pt.innerXml, "DepartureTime");
            const departureDayOffset = getChildText(
              pt.innerXml,
              "DepartureDayOffset",
            );

            if (i !== 0) {
              // Check departure→arrival doesn't decrease (same day offset).
              if (
                prevDepartureTime &&
                arrivalTime &&
                prevDepartureTime > arrivalTime &&
                arrivalDayOffset === prevArrivalDayOffset
              ) {
                errors.push(
                  consistencyError(
                    RULE_NAME,
                    `Passing time decreased in \`<ServiceJourney id="${journeyId}" />\`, ` +
                      `\`<TimetabledPassingTime id="${ptId}" />\``,
                    pt.line,
                  ),
                );
              }
            }

            // Check ArrivalDayOffset doesn't decrease.
            if (
              arrivalDayOffset &&
              prevArrivalDayOffset &&
              arrivalDayOffset < prevArrivalDayOffset
            ) {
              errors.push(
                consistencyError(
                  RULE_NAME,
                  `\`ArrivalDayOffset\` must not decrease in sequence in \`<ServiceJourney id="${journeyId}" />\`, ` +
                    `\`<TimetabledPassingTime id="${ptId}" />\``,
                  pt.line,
                ),
              );
            }

            // Check DepartureDayOffset doesn't decrease.
            if (
              departureDayOffset &&
              prevDepartureDayOffset &&
              departureDayOffset < prevDepartureDayOffset
            ) {
              errors.push(
                consistencyError(
                  RULE_NAME,
                  `\`DepartureDayOffset\` must not decrease in sequence in \`<ServiceJourney id="${journeyId}" />\`, ` +
                    `\`<TimetabledPassingTime id="${ptId}" />\``,
                  pt.line,
                ),
              );
            }

            prevDepartureTime = departureTime;
            prevArrivalDayOffset = arrivalDayOffset;
            prevDepartureDayOffset = departureDayOffset;
          }
        }
      }
    }

    return errors;
  },
};
