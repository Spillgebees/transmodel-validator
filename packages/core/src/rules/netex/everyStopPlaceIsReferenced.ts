/**
 * Rule: everyStopPlaceIsReferenced
 *
 * Every StopPlace must be referenced by at least one StopPlaceRef
 * somewhere in the document.
 */

import { consistencyError } from "../../errors.js";
import type { DocumentInput, Rule, ValidationError } from "../../types.js";
import { findAll, getAttr } from "../../xml/helpers.js";
import { findNeTExElements, STOP_PLACES } from "../../xml/paths.js";

const RULE_NAME = "everyStopPlaceIsReferenced";

export const everyStopPlaceIsReferenced: Rule = {
  name: RULE_NAME,
  displayName: "`StopPlace` references",
  description:
    "Every `StopPlace` must be referenced by at least one `StopPlaceRef`.",
  formats: ["netex"],

  async run(documents: DocumentInput[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const doc of documents) {
      const stopPlaces = findNeTExElements(doc.xml, STOP_PLACES);

      // Pre-collect all StopPlaceRef @ref values for fast lookup.
      const refs = findAll(doc.xml, "StopPlaceRef");
      const refValues = new Set(
        refs.map((r) => getAttr(r.openTag, "ref")).filter(Boolean),
      );

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

        if (!refValues.has(id)) {
          errors.push(
            consistencyError(
              RULE_NAME,
              `Missing reference for \`<StopPlace id="${id}" />\``,
              sp.line,
            ),
          );
        }
      }
    }

    return errors;
  },
};
