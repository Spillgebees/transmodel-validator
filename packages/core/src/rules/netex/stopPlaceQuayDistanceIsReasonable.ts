/**
 * Rule: stopPlaceQuayDistanceIsReasonable
 *
 * For each StopPlace, checks that every Quay is within a reasonable
 * distance of the StopPlace's centroid. Default threshold: 500m.
 *
 * Prerequisites:
 * - FrameDefaults must have a DefaultLocationSystem containing "4326" or "WGS84".
 */

import type {
  DocumentInput,
  Rule,
  RuleConfig,
  ValidationError,
} from "@transmodel-validator/shared";
import { qualityError, skippedInfo } from "@transmodel-validator/shared";
import { haversineMeters } from "../../xml/geo.js";
import {
  findChildren,
  getAttr,
  getChildText,
  innerBaseLine,
  innerBaseOffset,
} from "../../xml/helpers.js";
import {
  FRAME_DEFAULTS,
  findNeTExElements,
  STOP_PLACES,
} from "../../xml/paths.js";

const RULE_NAME = "stopPlaceQuayDistanceIsReasonable";
const DEFAULT_DISTANCE_THRESHOLD = 500; // meters

export const stopPlaceQuayDistanceIsReasonable: Rule = {
  name: RULE_NAME,
  displayName: "`StopPlace`\u2013`Quay` distance",
  description:
    "Distance between a `StopPlace` centroid and each of its `Quay`s must be reasonable.",
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

    for (const doc of documents) {
      // Check prerequisite: FrameDefaults/DefaultLocale/DefaultLocationSystem
      const frameDefaults = findNeTExElements(doc.xml, FRAME_DEFAULTS);
      if (frameDefaults.length === 0) {
        errors.push(
          skippedInfo(
            RULE_NAME,
            "Skipped: document has no `<FrameDefaults />` element",
          ),
        );
        continue;
      }

      const locationSystem = getChildText(
        frameDefaults[0].innerXml,
        "DefaultLocationSystem",
      );
      if (!locationSystem) {
        errors.push(
          skippedInfo(
            RULE_NAME,
            "Skipped: `<FrameDefaults />` has no `<DefaultLocationSystem />`",
          ),
        );
        continue;
      }
      if (
        !locationSystem.includes("4326") &&
        !locationSystem.includes("WGS84")
      ) {
        errors.push(
          skippedInfo(
            RULE_NAME,
            "Skipped: coordinate system is not `WGS84`/`EPSG:4326`",
          ),
        );
        continue;
      }

      // Validate distances
      const stopPlaces = findNeTExElements(doc.xml, STOP_PLACES);

      for (const sp of stopPlaces) {
        const id = getAttr(sp.openTag, "id");
        const spLat = parseCoord(sp.innerXml, "Centroid/Location/Latitude");
        const spLon = parseCoord(sp.innerXml, "Centroid/Location/Longitude");
        if (spLat === undefined || spLon === undefined) continue;

        const quays = findChildren(
          sp.innerXml,
          "Quay",
          innerBaseOffset(sp),
          innerBaseLine(sp),
        );
        // Quays might be inside a <quays> wrapper
        const quaysContainer = findChildren(
          sp.innerXml,
          "quays",
          innerBaseOffset(sp),
          innerBaseLine(sp),
        );
        const allQuays =
          quaysContainer.length > 0
            ? findChildren(
                quaysContainer[0].innerXml,
                "Quay",
                innerBaseOffset(quaysContainer[0]),
                innerBaseLine(quaysContainer[0]),
              )
            : quays;

        for (const quay of allQuays) {
          const quayId = getAttr(quay.openTag, "id");
          const qLat = parseCoord(quay.innerXml, "Centroid/Location/Latitude");
          const qLon = parseCoord(quay.innerXml, "Centroid/Location/Longitude");
          if (qLat === undefined || qLon === undefined) continue;

          const distance = haversineMeters(spLat, spLon, qLat, qLon);
          if (distance > threshold) {
            errors.push(
              qualityError(
                RULE_NAME,
                `Distance between \`<StopPlace id="${id}" />\` and \`<Quay id="${quayId}" />\` ` +
                  `exceeds **${threshold}m** (distance: **${distance}m**)`,
                sp.line,
              ),
            );
          }
        }
      }
    }

    return errors;
  },
};

/**
 * Parse a coordinate value by navigating a `/`-separated path of child
 * elements and reading the text content of the final element.
 */
function parseCoord(xml: string, path: string): number | undefined {
  const segments = path.split("/");
  let current = xml;
  for (const seg of segments.slice(0, -1)) {
    const children = findChildren(current, seg);
    if (children.length === 0) return undefined;
    current = children[0].innerXml;
  }
  const leaf = getChildText(current, segments[segments.length - 1]);
  if (!leaf) return undefined;
  const n = parseFloat(leaf);
  return Number.isNaN(n) ? undefined : n;
}
