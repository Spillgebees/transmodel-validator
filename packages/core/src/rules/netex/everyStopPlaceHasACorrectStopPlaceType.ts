/**
 * Rule: everyStopPlaceHasACorrectStopPlaceType
 *
 * Every StopPlace must have a StopPlaceType child element whose value is
 * one of the allowed NeTEx enum values.
 */

import type {
  DocumentInput,
  Rule,
  ValidationError,
} from "@transmodel-validator/shared";
import { consistencyError } from "@transmodel-validator/shared";
import { getAttr, getChildText } from "../../xml/helpers.js";
import { findNeTExElements, STOP_PLACES } from "../../xml/paths.js";

const RULE_NAME = "everyStopPlaceHasACorrectStopPlaceType";

/** Allowed NeTEx StopPlaceType enum values. */
const VALID_STOP_PLACE_TYPES = new Set([
  "onstreetBus",
  "onstreetTram",
  "busStation",
  "airport",
  "railStation",
  "metroStation",
  "coachStation",
  "ferryPort",
  "harbourPort",
  "ferryStop",
  "liftStation",
  "tramStation",
  "vehicleRailInterchange",
  "taxiStand",
  "other",
]);

export const everyStopPlaceHasACorrectStopPlaceType: Rule = {
  name: RULE_NAME,
  displayName: "`StopPlace` types",
  description:
    "Every `StopPlace` must have a valid `StopPlaceType` from the NeTEx enum.",
  formats: ["netex"],

  async run(documents: DocumentInput[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const doc of documents) {
      const stopPlaces = findNeTExElements(doc.xml, STOP_PLACES);

      for (const sp of stopPlaces) {
        const id = getAttr(sp.openTag, "id");
        const stopType = getChildText(sp.innerXml, "StopPlaceType");

        if (!stopType) {
          errors.push(
            consistencyError(
              RULE_NAME,
              `\`<StopPlaceType>\` is not set for \`<StopPlace id="${id}" />\``,
              sp.line,
            ),
          );
          continue;
        }

        if (!VALID_STOP_PLACE_TYPES.has(stopType)) {
          errors.push(
            consistencyError(
              RULE_NAME,
              `\`<StopPlaceType>\` is not valid for \`<StopPlace id="${id}" />\``,
              sp.line,
            ),
          );
        }
      }
    }

    return errors;
  },
};
