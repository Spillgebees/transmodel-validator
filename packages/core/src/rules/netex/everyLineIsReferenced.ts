/**
 * Rule: everyLineIsReferenced
 *
 * Every Line element in ServiceFrame/lines must be referenced by at least
 * one LineRef element somewhere across all documents in the dataset.
 *
 * NOTE: This is a cross-document rule. LineRef values are collected from ALL
 * documents first, then each Line definition is checked against the merged set.
 * This avoids false positives when Line definitions and their references live
 * in separate files (which is valid in NeTEx).
 */

import type {
  DocumentInput,
  Rule,
  ValidationError,
} from "@transmodel-validator/shared";
import { consistencyError } from "@transmodel-validator/shared";
import { findAll, getAttr } from "../../xml/helpers.js";
import { findNeTExElements, LINES } from "../../xml/paths.js";

const RULE_NAME = "everyLineIsReferenced";

export const everyLineIsReferenced: Rule = {
  name: RULE_NAME,
  displayName: "`Line` references",
  description:
    "Every `Line` must be referenced by at least one `LineRef` across all documents.",
  formats: ["netex"],

  async run(documents: DocumentInput[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // First pass: collect ALL LineRef @ref values across all documents.
    const refValues = new Set<string>();
    for (const doc of documents) {
      const lineRefs = findAll(doc.xml, "LineRef");
      for (const r of lineRefs) {
        const ref = getAttr(r.openTag, "ref");
        if (ref) refValues.add(ref);
      }
    }

    // Second pass: check each Line definition against the merged set.
    for (const doc of documents) {
      const lines = findNeTExElements(doc.xml, LINES);

      for (const line of lines) {
        const id = getAttr(line.openTag, "id");

        if (!id) {
          errors.push(
            consistencyError(
              RULE_NAME,
              "`<Line>` is missing attribute `@id`",
              line.line,
              doc.fileName,
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
              doc.fileName,
            ),
          );
        }
      }
    }

    return errors;
  },
};
