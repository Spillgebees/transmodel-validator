/**
 * Common NeTEx element paths used by business rules.
 *
 * NeTEx documents can use two structural patterns:
 *   - **Composite**: `dataObjects/CompositeFrame/frames/ServiceFrame/...`
 *   - **Flat**: `dataObjects/ServiceFrame/...`
 *
 * Each path constant is an array of variants (composite first, then flat).
 * Use `findNeTExElements()` to search all variants and return the first match.
 */

import type { XmlElement } from "./helpers.js";
import { navigatePath } from "./helpers.js";

/** A set of path variants to try, in order. */
export type NeTExPath = readonly string[];

/** Composite frame base: `dataObjects/CompositeFrame/frames` */
const COMPOSITE = "dataObjects/CompositeFrame/frames";

/** Flat frame base: `dataObjects` */
const FLAT = "dataObjects";

/**
 * Paths to `<FrameDefaults>`.
 *
 * NOTE: FrameDefaults can live at the CompositeFrame level (shared defaults)
 * or at the individual frame level (in both composite and flat layouts).
 * We check the CompositeFrame level first, then fall back to any frame
 * that has FrameDefaults directly under dataObjects.
 */
export const FRAME_DEFAULTS: NeTExPath = [
  "dataObjects/CompositeFrame/FrameDefaults",
  `${FLAT}/ResourceFrame/FrameDefaults`,
  `${FLAT}/ServiceFrame/FrameDefaults`,
  `${FLAT}/SiteFrame/FrameDefaults`,
  `${FLAT}/TimetableFrame/FrameDefaults`,
  `${FLAT}/GeneralFrame/FrameDefaults`,
];

/** Paths to `<Line>` elements. */
export const LINES: NeTExPath = [
  `${COMPOSITE}/ServiceFrame/lines/Line`,
  `${FLAT}/ServiceFrame/lines/Line`,
];

/** Paths to `<ScheduledStopPoint>` elements. */
export const SCHEDULED_STOP_POINTS: NeTExPath = [
  `${COMPOSITE}/ServiceFrame/scheduledStopPoints/ScheduledStopPoint`,
  `${FLAT}/ServiceFrame/scheduledStopPoints/ScheduledStopPoint`,
];

/** Paths to `<PassengerStopAssignment>` elements. */
export const STOP_ASSIGNMENTS: NeTExPath = [
  `${COMPOSITE}/ServiceFrame/stopAssignments/PassengerStopAssignment`,
  `${FLAT}/ServiceFrame/stopAssignments/PassengerStopAssignment`,
];

/** Paths to `<StopPlace>` elements. */
export const STOP_PLACES: NeTExPath = [
  `${COMPOSITE}/SiteFrame/stopPlaces/StopPlace`,
  `${FLAT}/SiteFrame/stopPlaces/StopPlace`,
];

/** Paths to `<ServiceJourney>` elements. */
export const SERVICE_JOURNEYS: NeTExPath = [
  `${COMPOSITE}/TimetableFrame/vehicleJourneys/ServiceJourney`,
  `${FLAT}/TimetableFrame/vehicleJourneys/ServiceJourney`,
];

/**
 * Search for NeTEx elements by trying each path variant in order.
 * Returns results from the **first variant that finds any matches**.
 *
 * @param xml - Raw XML content of the document.
 * @param paths - Array of path variants to try.
 * @returns Matching elements from the first successful variant, or `[]`.
 */
export function findNeTExElements(xml: string, paths: NeTExPath): XmlElement[] {
  for (const path of paths) {
    const results = navigatePath(xml, path);
    if (results.length > 0) return results;
  }
  return [];
}
