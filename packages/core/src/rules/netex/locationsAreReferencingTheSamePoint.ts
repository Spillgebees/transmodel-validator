/**
 * Rule: locationsAreReferencingTheSamePoint
 *
 * For each PassengerStopAssignment, verifies that the referenced
 * ScheduledStopPoint and StopPlace are geographically close (within
 * a configurable threshold, default 100m).
 *
 * NOTE: This is a cross-document rule. StopPlace and ScheduledStopPoint
 * lookup maps are built from ALL documents first, then each
 * PassengerStopAssignment is checked against the merged maps. This avoids
 * false positives when definitions and assignments live in separate files
 * (which is valid in NeTEx).
 *
 * Note: StopPlace uses Centroid/Location/{Lat,Lon} while
 * ScheduledStopPoint uses Location/{Lat,Lon} (no Centroid wrapper).
 */

import type {
  DocumentInput,
  Rule,
  RuleConfig,
  ValidationError,
} from "@transmodel-validator/shared";
import { consistencyError } from "@transmodel-validator/shared";
import { haversineMeters } from "../../xml/geo.js";
import {
  findChildren,
  getAttr,
  getChildText,
  innerBaseLine,
  innerBaseOffset,
} from "../../xml/helpers.js";
import {
  findNeTExElements,
  SCHEDULED_STOP_POINTS,
  STOP_ASSIGNMENTS,
  STOP_PLACES,
} from "../../xml/paths.js";

const RULE_NAME = "locationsAreReferencingTheSamePoint";
const DEFAULT_DISTANCE_THRESHOLD = 100; // meters

export const locationsAreReferencingTheSamePoint: Rule = {
  name: RULE_NAME,
  displayName: "Stop assignment locations",
  description:
    "`ScheduledStopPoint` and `StopPlace` in a `PassengerStopAssignment` must be geographically close across all documents.",
  formats: ["netex"],

  async run(
    documents: DocumentInput[],
    config?: RuleConfig,
  ): Promise<ValidationError[]> {
    const threshold =
      typeof config?.distance === "number"
        ? config.distance
        : DEFAULT_DISTANCE_THRESHOLD;
    const errors: ValidationError[] = [];

    // First pass: build global maps from all documents.
    const stopPlaceMap = new Map<string, GeoPoint>();
    const sspMap = new Map<string, GeoPoint>();
    for (const doc of documents) {
      for (const [id, point] of buildStopPlaceMap(doc.xml)) {
        stopPlaceMap.set(id, point);
      }
      for (const [id, point] of buildScheduledStopPointMap(doc.xml)) {
        sspMap.set(id, point);
      }
    }

    // Second pass: check assignments from all documents.
    for (const doc of documents) {
      const assignments = findNeTExElements(doc.xml, STOP_ASSIGNMENTS);

      for (const assignment of assignments) {
        const assignId = getAttr(assignment.openTag, "id");

        // Get the ScheduledStopPointRef
        const sspRefs = findChildren(
          assignment.innerXml,
          "ScheduledStopPointRef",
          innerBaseOffset(assignment),
          innerBaseLine(assignment),
        );
        const sspRefId =
          sspRefs.length > 0 ? getAttr(sspRefs[0].openTag, "ref") : undefined;

        if (!sspRefId || !sspMap.has(sspRefId)) {
          errors.push(
            consistencyError(
              RULE_NAME,
              `Missing \`<ScheduledStopPoint>\` for \`<PassengerStopAssignment id="${assignId}" />\``,
              assignment.line,
              doc.fileName,
            ),
          );
          continue;
        }

        // Get the StopPlaceRef
        const spRefs = findChildren(
          assignment.innerXml,
          "StopPlaceRef",
          innerBaseOffset(assignment),
          innerBaseLine(assignment),
        );
        const spRefId =
          spRefs.length > 0 ? getAttr(spRefs[0].openTag, "ref") : undefined;

        if (!spRefId || !stopPlaceMap.has(spRefId)) {
          errors.push(
            consistencyError(
              RULE_NAME,
              `Missing \`<StopPlace>\` for \`<PassengerStopAssignment id="${assignId}" />\``,
              assignment.line,
              doc.fileName,
            ),
          );
          continue;
        }

        const sp = stopPlaceMap.get(spRefId)!;
        const ssp = sspMap.get(sspRefId)!;

        if (
          sp.lat === undefined ||
          sp.lon === undefined ||
          ssp.lat === undefined ||
          ssp.lon === undefined
        ) {
          continue; // Can't compare without coordinates.
        }

        const distance = haversineMeters(sp.lat, sp.lon, ssp.lat, ssp.lon);
        if (distance > threshold) {
          errors.push(
            consistencyError(
              RULE_NAME,
              `\`<ScheduledStopPoint>\` and \`<StopPlace>\` are too far apart ` +
                `(\`<PassengerStopAssignment id="${assignId}" />\`, distance: **${distance}m**)`,
              assignment.line,
              doc.fileName,
            ),
          );
        }
      }
    }

    return errors;
  },
};

interface GeoPoint {
  lat: number | undefined;
  lon: number | undefined;
}

function buildStopPlaceMap(xml: string): Map<string, GeoPoint> {
  const map = new Map<string, GeoPoint>();
  const stopPlaces = findNeTExElements(xml, STOP_PLACES);
  for (const sp of stopPlaces) {
    const id = getAttr(sp.openTag, "id");
    if (!id) continue;
    map.set(id, {
      lat: parseNestedCoord(sp.innerXml, ["Centroid", "Location", "Latitude"]),
      lon: parseNestedCoord(sp.innerXml, ["Centroid", "Location", "Longitude"]),
    });
  }
  return map;
}

function buildScheduledStopPointMap(xml: string): Map<string, GeoPoint> {
  const map = new Map<string, GeoPoint>();
  const ssps = findNeTExElements(xml, SCHEDULED_STOP_POINTS);
  for (const ssp of ssps) {
    const id = getAttr(ssp.openTag, "id");
    if (!id) continue;
    map.set(id, {
      lat: parseNestedCoord(ssp.innerXml, ["Location", "Latitude"]),
      lon: parseNestedCoord(ssp.innerXml, ["Location", "Longitude"]),
    });
  }
  return map;
}

function parseNestedCoord(xml: string, path: string[]): number | undefined {
  let current = xml;
  for (const seg of path.slice(0, -1)) {
    const children = findChildren(current, seg);
    if (children.length === 0) return undefined;
    current = children[0].innerXml;
  }
  const text = getChildText(current, path[path.length - 1]);
  if (!text) return undefined;
  const n = parseFloat(text);
  return Number.isNaN(n) ? undefined : n;
}
