/**
 * Rule: everyLineIsReferenced
 *
 * Every Line element in ServiceFrame/lines must be referenced by at least
 * one LineRef element somewhere in the document.
 */

import { consistencyError } from "../../errors.js";
import type { DocumentInput, Rule, ValidationError } from "../../types.js";
import { findAll, getAttr } from "../../xml/helpers.js";
import { findNeTExElements, LINES } from "../../xml/paths.js";

const RULE_NAME = "everyLineIsReferenced";

export const everyLineIsReferenced: Rule = {
  name: RULE_NAME,
  displayName: "`Line` references",
  description:
    "Every `Line` must be referenced by at least one `LineRef` in the document.",
  formats: ["netex"],

  async run(documents: DocumentInput[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const doc of documents) {
      const lines = findNeTExElements(doc.xml, LINES);

      // Pre-collect all LineRef @ref values in the document for fast lookup.
      const lineRefs = findAll(doc.xml, "LineRef");
      const refValues = new Set(
        lineRefs.map((r) => getAttr(r.openTag, "ref")).filter(Boolean),
      );

      for (const line of lines) {
        const id = getAttr(line.openTag, "id");

        if (!id) {
          errors.push(
            consistencyError(
              RULE_NAME,
              "`<Line>` is missing attribute `@id`",
              line.line,
            ),
          );
          continue;
        }

        if (!refValues.has(id)) {
          errors.push(
            consistencyError(
              RULE_NAME,
              `Missing reference for \`<Line id="${id}" />\``,
              line.line,
            ),
          );
        }
      }
    }

    return errors;
  },
};
