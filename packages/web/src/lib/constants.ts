/**
 * Client-safe constants for the web UI.
 *
 * These are duplicated from @transmodel-validator/core to avoid pulling
 * Node.js-only code into the browser bundle. Keep in sync with core.
 */

/** Metadata about a single validation rule. */
export interface RuleInfo {
  name: string;
  displayName: string;
  description: string;
}

export const NETEX_RULES: readonly RuleInfo[] = [
  {
    name: "everyLineIsReferenced",
    displayName: "`Line` references",
    description:
      "Every `Line` must be referenced by at least one `LineRef` across all documents.",
  },
  {
    name: "everyStopPlaceHasAName",
    displayName: "`StopPlace` names",
    description: "Every `StopPlace` must have a `Name` or `ShortName`.",
  },
  {
    name: "everyStopPlaceHasACorrectStopPlaceType",
    displayName: "`StopPlace` types",
    description:
      "Every `StopPlace` must have a valid `StopPlaceType` from the NeTEx enum.",
  },
  {
    name: "everyStopPlaceIsReferenced",
    displayName: "`StopPlace` references",
    description:
      "Every `StopPlace` must be referenced by at least one `StopPlaceRef` across all documents.",
  },
  {
    name: "everyStopPointHasArrivalAndDepartureTime",
    displayName: "Arrival & departure times",
    description:
      "Every stop in a `ServiceJourney` must have appropriate arrival/departure times.",
  },
  {
    name: "everyScheduledStopPointHasAName",
    displayName: "`ScheduledStopPoint` names",
    description:
      "Every `ScheduledStopPoint` must have a `Name` or `ShortName`.",
  },
  {
    name: "stopPlaceQuayDistanceIsReasonable",
    displayName: "`StopPlace`–`Quay` distance",
    description:
      "Distance between a `StopPlace` centroid and each of its `Quay`s must be reasonable.",
  },
  {
    name: "frameDefaultsHaveALocaleAndTimeZone",
    displayName: "Locale & timezone defaults",
    description:
      "`FrameDefaults` must have valid locale and timezone settings (when present).",
  },
  {
    name: "locationsAreReferencingTheSamePoint",
    displayName: "Stop assignment locations",
    description:
      "`ScheduledStopPoint` and `StopPlace` in a `PassengerStopAssignment` must be geographically close across all documents.",
  },
  {
    name: "passingTimesIsNotDecreasing",
    displayName: "Passing time order",
    description:
      "Passing times in a `ServiceJourney` must not decrease between consecutive stops.",
  },
  {
    name: "netexKeyRefConstraints",
    displayName: "Key reference constraints",
    description:
      "Validates `xsd:keyref` constraints from the NeTEx schema across all documents — references in one file can resolve to keys in another.",
  },
  {
    name: "netexPrerequisitesAreSatisfied",
    displayName: "Frame prerequisites",
    description:
      "Validates that declared frame `<prerequisites>` are present and recommends their use for cross-file references.",
  },
  {
    name: "netexUniqueConstraints",
    displayName: "Uniqueness constraints",
    description:
      "Validates `xsd:unique` constraints from the NeTEx schema \u2014 no duplicate keys within each document, and across frames linked by `<prerequisites>`.",
  },
];

export const NETEX_RULE_NAMES = NETEX_RULES.map((r) => r.name);

export const SIRI_RULES: readonly RuleInfo[] = [];
export const SIRI_RULE_NAMES: readonly string[] = [];

/** Describes a selectable XSD schema version. */
export interface SchemaVersionOption {
  id: string;
  label: string;
  format: "netex" | "siri";
}

export const SCHEMA_VERSIONS: readonly SchemaVersionOption[] = [
  // NeTEx
  { id: "netex@1.2-nc", label: "NeTEx v1.2 (No Constraints)", format: "netex" },
  { id: "netex@1.2", label: "NeTEx v1.2 (Full Constraints)", format: "netex" },
  {
    id: "netex@1.2.2-nc",
    label: "NeTEx v1.2.2 (No Constraints)",
    format: "netex",
  },
  {
    id: "netex@1.2.2",
    label: "NeTEx v1.2.2 (Full Constraints)",
    format: "netex",
  },
  {
    id: "netex@1.2.3-nc",
    label: "NeTEx v1.2.3 (No Constraints)",
    format: "netex",
  },
  {
    id: "netex@1.2.3",
    label: "NeTEx v1.2.3 (Full Constraints)",
    format: "netex",
  },
  {
    id: "netex@1.3.0-nc",
    label: "NeTEx v1.3.0 (No Constraints)",
    format: "netex",
  },
  {
    id: "netex@1.3.0",
    label: "NeTEx v1.3.0 (Full Constraints)",
    format: "netex",
  },
  {
    id: "netex@1.3.1-nc",
    label: "NeTEx v1.3.1 (No Constraints)",
    format: "netex",
  },
  {
    id: "netex@1.3.1",
    label: "NeTEx v1.3.1 (Full Constraints)",
    format: "netex",
  },
  { id: "epip@1.1.2", label: "EPIP v1.1.2", format: "netex" },
  // SIRI
  { id: "siri@2.1", label: "SIRI v2.1", format: "siri" },
  { id: "siri@2.2", label: "SIRI v2.2", format: "siri" },
];
