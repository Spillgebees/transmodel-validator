/**
 * Rule registry — central index of all available business rules.
 */

import type { Rule } from "../types.js";

// NeTEx rules
import { everyLineIsReferenced } from "./netex/everyLineIsReferenced.js";
import { everyScheduledStopPointHasAName } from "./netex/everyScheduledStopPointHasAName.js";
import { everyStopPlaceHasACorrectStopPlaceType } from "./netex/everyStopPlaceHasACorrectStopPlaceType.js";
import { everyStopPlaceHasAName } from "./netex/everyStopPlaceHasAName.js";
import { everyStopPlaceIsReferenced } from "./netex/everyStopPlaceIsReferenced.js";
import { everyStopPointHasArrivalAndDepartureTime } from "./netex/everyStopPointHasArrivalAndDepartureTime.js";
import { frameDefaultsHaveALocaleAndTimeZone } from "./netex/frameDefaultsHaveALocaleAndTimeZone.js";
import { locationsAreReferencingTheSamePoint } from "./netex/locationsAreReferencingTheSamePoint.js";
import { netexKeyRefConstraints } from "./netex/netexKeyRefConstraints.js";
import { netexUniqueConstraints } from "./netex/netexUniqueConstraints.js";
import { passingTimesIsNotDecreasing } from "./netex/passingTimesIsNotDecreasing.js";
import { stopPlaceQuayDistanceIsReasonable } from "./netex/stopPlaceQuayDistanceIsReasonable.js";

// SIRI rules — none yet.
// See https://github.com/Spillgebees/transmodel-validator/issues to request.

/** All registered rules, keyed by name. */
export const RULE_REGISTRY: ReadonlyMap<string, Rule> = new Map<string, Rule>([
  [everyLineIsReferenced.name, everyLineIsReferenced],
  [everyStopPlaceHasAName.name, everyStopPlaceHasAName],
  [
    everyStopPlaceHasACorrectStopPlaceType.name,
    everyStopPlaceHasACorrectStopPlaceType,
  ],
  [everyStopPlaceIsReferenced.name, everyStopPlaceIsReferenced],
  [
    everyStopPointHasArrivalAndDepartureTime.name,
    everyStopPointHasArrivalAndDepartureTime,
  ],
  [everyScheduledStopPointHasAName.name, everyScheduledStopPointHasAName],
  [stopPlaceQuayDistanceIsReasonable.name, stopPlaceQuayDistanceIsReasonable],
  [
    frameDefaultsHaveALocaleAndTimeZone.name,
    frameDefaultsHaveALocaleAndTimeZone,
  ],
  [
    locationsAreReferencingTheSamePoint.name,
    locationsAreReferencingTheSamePoint,
  ],
  [passingTimesIsNotDecreasing.name, passingTimesIsNotDecreasing],
  [netexKeyRefConstraints.name, netexKeyRefConstraints],
  [netexUniqueConstraints.name, netexUniqueConstraints],
]);

/** All NeTEx rule names. */
export const NETEX_RULE_NAMES: readonly string[] = [
  everyLineIsReferenced.name,
  everyStopPlaceHasAName.name,
  everyStopPlaceHasACorrectStopPlaceType.name,
  everyStopPlaceIsReferenced.name,
  everyStopPointHasArrivalAndDepartureTime.name,
  everyScheduledStopPointHasAName.name,
  stopPlaceQuayDistanceIsReasonable.name,
  frameDefaultsHaveALocaleAndTimeZone.name,
  locationsAreReferencingTheSamePoint.name,
  passingTimesIsNotDecreasing.name,
  netexKeyRefConstraints.name,
  netexUniqueConstraints.name,
];

/** All SIRI rule names (empty for now). */
export const SIRI_RULE_NAMES: readonly string[] = [];

/** Get a rule by name. Throws if not found. */
export function getRule(name: string): Rule {
  const rule = RULE_REGISTRY.get(name);
  if (!rule) {
    throw new Error(
      `Unknown rule: "${name}". Available rules: ${[...RULE_REGISTRY.keys()].join(", ")}`,
    );
  }
  return rule;
}

/** Get all rules for a given format. */
export function getRulesForFormat(format: "netex" | "siri"): Rule[] {
  return [...RULE_REGISTRY.values()].filter((r) => r.formats.includes(format));
}
