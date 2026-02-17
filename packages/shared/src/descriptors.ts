/**
 * Static descriptors for validation rules and schema versions.
 *
 * Single source of truth for metadata displayed in the CLI and web UI.
 */

import type { RuleDescriptor, SchemaId, TransmodelFormat } from "./types.js";

/** Describes a selectable XSD schema version for UI display. */
export interface SchemaVersionDescriptor {
  /** Schema registry key. */
  id: SchemaId | string;
  /** Human-readable label. */
  label: string;
  /** Which format this schema targets. */
  format: TransmodelFormat;
}

/** All NeTEx rule descriptors, in registry order. */
export const NETEX_RULE_DESCRIPTORS: readonly RuleDescriptor[] = [
  {
    name: "everyLineIsReferenced",
    displayName: "`Line` references",
    description:
      "Every `Line` must be referenced by at least one `LineRef` across all documents.",
    formats: ["netex"],
  },
  {
    name: "everyStopPlaceHasAName",
    displayName: "`StopPlace` names",
    description: "Every `StopPlace` must have a `Name` or `ShortName`.",
    formats: ["netex"],
  },
  {
    name: "everyStopPlaceHasACorrectStopPlaceType",
    displayName: "`StopPlace` types",
    description:
      "Every `StopPlace` must have a valid `StopPlaceType` from the NeTEx enum.",
    formats: ["netex"],
  },
  {
    name: "everyStopPlaceIsReferenced",
    displayName: "`StopPlace` references",
    description:
      "Every `StopPlace` must be referenced by at least one `StopPlaceRef` across all documents.",
    formats: ["netex"],
  },
  {
    name: "everyStopPointHasArrivalAndDepartureTime",
    displayName: "Arrival & departure times",
    description:
      "Every stop in a `ServiceJourney` must have appropriate arrival/departure times.",
    formats: ["netex"],
  },
  {
    name: "everyScheduledStopPointHasAName",
    displayName: "`ScheduledStopPoint` names",
    description:
      "Every `ScheduledStopPoint` must have a `Name` or `ShortName`.",
    formats: ["netex"],
  },
  {
    name: "stopPlaceQuayDistanceIsReasonable",
    displayName: "`StopPlace`\u2013`Quay` distance",
    description:
      "Distance between a `StopPlace` centroid and each of its `Quay`s must be reasonable.",
    formats: ["netex"],
  },
  {
    name: "frameDefaultsHaveALocaleAndTimeZone",
    displayName: "Locale & timezone defaults",
    description:
      "`FrameDefaults` must have valid locale and timezone settings (when present).",
    formats: ["netex"],
  },
  {
    name: "locationsAreReferencingTheSamePoint",
    displayName: "Stop assignment locations",
    description:
      "`ScheduledStopPoint` and `StopPlace` in a `PassengerStopAssignment` must be geographically close across all documents.",
    formats: ["netex"],
  },
  {
    name: "passingTimesIsNotDecreasing",
    displayName: "Passing time order",
    description:
      "Passing times in a `ServiceJourney` must not decrease between consecutive stops.",
    formats: ["netex"],
  },
  {
    name: "netexKeyRefConstraints",
    displayName: "Key reference constraints",
    description:
      "Validates `xsd:keyref` constraints from the NeTEx schema across all documents \u2014 references in one file can resolve to keys in another.",
    formats: ["netex"],
  },
  {
    name: "netexPrerequisitesAreSatisfied",
    displayName: "Frame prerequisites",
    description:
      "Validates that declared frame `<prerequisites>` are present and recommends their use for cross-file references.",
    formats: ["netex"],
  },
  {
    name: "netexUniqueConstraints",
    displayName: "Uniqueness constraints",
    description:
      "Validates `xsd:unique` constraints from the NeTEx schema \u2014 no duplicate keys within each document, and across frames linked by `<prerequisites>`.",
    formats: ["netex"],
  },
];

/** All SIRI rule descriptors (none yet). */
export const SIRI_RULE_DESCRIPTORS: readonly RuleDescriptor[] = [];

/** All NeTEx rule names, derived from descriptors. */
export const NETEX_RULE_NAMES: readonly string[] = NETEX_RULE_DESCRIPTORS.map(
  (r) => r.name,
);

/** All SIRI rule names (empty for now). */
export const SIRI_RULE_NAMES: readonly string[] = SIRI_RULE_DESCRIPTORS.map(
  (r) => r.name,
);

/** All selectable XSD schema versions for UI display. */
export const SCHEMA_VERSIONS: readonly SchemaVersionDescriptor[] = [
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
