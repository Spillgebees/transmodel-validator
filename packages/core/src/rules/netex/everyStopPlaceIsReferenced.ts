/**
 * Rule: everyStopPlaceIsReferenced
 *
 * Every StopPlace must be referenced by at least one StopPlaceRef
 * somewhere across all documents in the dataset.
 *
 * NOTE: This is a cross-document rule. StopPlaceRef values are collected from
 * ALL documents first, then each StopPlace definition is checked against the
 * merged set. This avoids false positives when StopPlace definitions and their
 * references live in separate files (which is valid in NeTEx).
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
    "Every `StopPlace` must be referenced by at least one `StopPlaceRef` across all documents.",
  formats: ["netex"],

  async run(documents: DocumentInput[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // First pass: collect ALL StopPlaceRef @ref values across all documents.
    const refValues = new Set<string>();
    for (const doc of documents) {
      const refs = findAll(doc.xml, "StopPlaceRef");
      for (const r of refs) {
        const ref = getAttr(r.openTag, "ref");
        if (ref) refValues.add(ref);
      }
    }

    // Second pass: check each StopPlace definition against the merged set.
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
              doc.fileName,
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
              doc.fileName,
            ),
          );
        }
      }
    }

    return errors;
  },
};
