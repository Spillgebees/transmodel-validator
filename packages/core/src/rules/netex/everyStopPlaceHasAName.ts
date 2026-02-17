/**
 * Rule: everyStopPlaceHasAName
 *
 * Every StopPlace must have either a Name or ShortName child element.
 */

import type {
  DocumentInput,
  Rule,
  ValidationError,
} from "@transmodel-validator/shared";
import { consistencyError } from "@transmodel-validator/shared";
import { getAttr, getChildText } from "../../xml/helpers.js";
import { findNeTExElements, STOP_PLACES } from "../../xml/paths.js";

const RULE_NAME = "everyStopPlaceHasAName";

export const everyStopPlaceHasAName: Rule = {
  name: RULE_NAME,
  displayName: "`StopPlace` names",
  description: "Every `StopPlace` must have a `Name` or `ShortName`.",
  formats: ["netex"],

  async run(documents: DocumentInput[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const doc of documents) {
      const stopPlaces = findNeTExElements(doc.xml, STOP_PLACES);

      for (const sp of stopPlaces) {
        const id = getAttr(sp.openTag, "id");

        if (!id) {
          errors.push(
            consistencyError(
              RULE_NAME,
              "`<StopPlace>` is missing attribute `@id`",
              sp.line,
            ),
          );
          continue;
        }

        const name = getChildText(sp.innerXml, "Name");
        const shortName = getChildText(sp.innerXml, "ShortName");

        if (!name && !shortName) {
          errors.push(
            consistencyError(
              RULE_NAME,
              `Missing name for \`<StopPlace id="${id}" />\``,
              sp.line,
            ),
          );
        }
      }
    }

    return errors;
  },
};
