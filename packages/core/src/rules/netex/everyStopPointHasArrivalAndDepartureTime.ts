/**
 * Rule: everyStopPointHasArrivalAndDepartureTime
 *
 * For each ServiceJourney's TimetabledPassingTime sequence:
 * - The first stop needs a DepartureTime (no ArrivalTime required).
 * - The last stop needs an ArrivalTime (no DepartureTime required).
 * - Intermediate stops need both ArrivalTime and DepartureTime.
 */

import type {
  DocumentInput,
  Rule,
  ValidationError,
} from "@transmodel-validator/shared";
import { consistencyError } from "@transmodel-validator/shared";
import {
  findChildren,
  getAttr,
  getChildText,
  innerBaseLine,
  innerBaseOffset,
} from "../../xml/helpers.js";
import { findNeTExElements, SERVICE_JOURNEYS } from "../../xml/paths.js";

const RULE_NAME = "everyStopPointHasArrivalAndDepartureTime";

export const everyStopPointHasArrivalAndDepartureTime: Rule = {
  name: RULE_NAME,
  displayName: "Arrival & departure times",
  description:
    "Every stop in a `ServiceJourney` must have appropriate arrival/departure times.",
  formats: ["netex"],

  async run(documents: DocumentInput[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const doc of documents) {
      const journeys = findNeTExElements(doc.xml, SERVICE_JOURNEYS);

      for (const journey of journeys) {
        // Find passingTimes/TimetabledPassingTime within this journey.
        const passingTimesContainers = findChildren(
          journey.innerXml,
          "passingTimes",
          innerBaseOffset(journey),
          innerBaseLine(journey),
        );
        for (const container of passingTimesContainers) {
          const passingTimes = findChildren(
            container.innerXml,
            "TimetabledPassingTime",
            innerBaseOffset(container),
            innerBaseLine(container),
          );

          for (let i = 0; i < passingTimes.length; i++) {
            const pt = passingTimes[i];
            const id = getAttr(pt.openTag, "id");
            const isFirst = i === 0;
            const isLast = i === passingTimes.length - 1;

            if (!id) {
              errors.push(
                consistencyError(
                  RULE_NAME,
                  "Element `<TimetabledPassingTime />` is missing attribute `@id`",
                  pt.line,
                ),
              );
            }

            const hasDeparture =
              getChildText(pt.innerXml, "DepartureTime") !== undefined;
            const hasArrival =
              getChildText(pt.innerXml, "ArrivalTime") !== undefined;

            if (!isLast && !hasDeparture) {
              errors.push(
                consistencyError(
                  RULE_NAME,
                  `Expected departure time in \`<TimetabledPassingTime id='${id ?? "?"}' />\``,
                  pt.line,
                ),
              );
            }

            if (!isFirst && !hasArrival) {
              errors.push(
                consistencyError(
                  RULE_NAME,
                  `Expected arrival time in \`<TimetabledPassingTime id='${id ?? "?"}' />\``,
                  pt.line,
                ),
              );
            }
          }
        }
      }
    }

    return errors;
  },
};
