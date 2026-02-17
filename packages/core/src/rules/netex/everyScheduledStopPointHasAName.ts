/**
 * Rule: everyScheduledStopPointHasAName
 *
 * Every ScheduledStopPoint must have either a Name or ShortName child element.
 */

import { consistencyError } from "../../errors.js";
import type { DocumentInput, Rule, ValidationError } from "../../types.js";
import { getAttr, getChildText } from "../../xml/helpers.js";
import { findNeTExElements, SCHEDULED_STOP_POINTS } from "../../xml/paths.js";

const RULE_NAME = "everyScheduledStopPointHasAName";

export const everyScheduledStopPointHasAName: Rule = {
  name: RULE_NAME,
  displayName: "`ScheduledStopPoint` names",
  description: "Every `ScheduledStopPoint` must have a `Name` or `ShortName`.",
  formats: ["netex"],

  async run(documents: DocumentInput[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const doc of documents) {
      const stopPoints = findNeTExElements(doc.xml, SCHEDULED_STOP_POINTS);

      for (const sp of stopPoints) {
        const id = getAttr(sp.openTag, "id");

        if (!id) {
          errors.push(
            consistencyError(
              RULE_NAME,
              "`<ScheduledStopPoint>` is missing attribute `@id`",
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
              `Missing name for \`<ScheduledStopPoint id="${id}" />\``,
              sp.line,
            ),
          );
        }
      }
    }

    return errors;
  },
};
