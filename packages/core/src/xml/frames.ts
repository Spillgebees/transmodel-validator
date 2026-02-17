/**
 * Helpers for parsing NeTEx VersionFrames and their prerequisite declarations.
 *
 * Provides utilities to extract frame metadata (id, version, type, prerequisites)
 * from NeTEx XML documents and build a prerequisite dependency graph across
 * multiple documents. Used by cross-document validation rules.
 */

import type { DocumentInput } from "../types.js";
import { findAll, findChildren, getAttr } from "./helpers.js";

/** Describes a NeTEx VersionFrame found in a document. */
export interface FrameInfo {
  /** The frame's `id` attribute. */
  id: string;
  /** The frame's `version` attribute (if present). */
  version: string | undefined;
  /** The frame element type (e.g. "ServiceFrame", "ResourceFrame"). */
  type: string;
  /** The source file name. */
  fileName: string;
  /** Prerequisites declared by this frame. */
  prerequisites: PrerequisiteRef[];
  /** The inner XML content of the frame. */
  innerXml: string;
  /** Line number in the source document. */
  line: number;
}

/** A reference to a prerequisite frame. */
export interface PrerequisiteRef {
  /** The referenced frame's `id`. */
  ref: string;
  /** The referenced frame's `version` (if specified). */
  version: string | undefined;
}

/**
 * Known NeTEx frame types to search for.
 *
 * NOTE: Order is not significant — all types are searched independently.
 */
const FRAME_TYPES = [
  "CompositeFrame",
  "ServiceFrame",
  "SiteFrame",
  "TimetableFrame",
  "ResourceFrame",
  "GeneralFrame",
  "SalesTransactionFrame",
  "FareFrame",
  "DriverScheduleFrame",
  "VehicleScheduleFrame",
  "InfrastructureFrame",
] as const;

/**
 * Parse prerequisite references from the inner XML of a frame element.
 *
 * Looks for a `<prerequisites>` element and extracts all child elements
 * whose name ends with `FrameRef`, reading their `ref` and `version` attributes.
 *
 * @param innerXml - The inner XML content of a frame element.
 * @returns Array of prerequisite references (empty if none found).
 */
export function parsePrerequisites(innerXml: string): PrerequisiteRef[] {
  const prereqElements = findChildren(innerXml, "prerequisites");
  if (prereqElements.length === 0) return [];

  const prereqInner = prereqElements[0].innerXml;
  const results: PrerequisiteRef[] = [];

  // Find all elements whose local name ends with "FrameRef".
  // Match opening tags like <ResourceFrameRef ...> or <ns:ServiceFrameRef ...>
  const frameRefRe =
    /<(?:[a-zA-Z0-9_]+:)?([a-zA-Z0-9_]*FrameRef)(\s[^>]*)?\s*\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = frameRefRe.exec(prereqInner)) !== null) {
    const fullTag = match[0];
    const ref = getAttr(fullTag, "ref");
    if (ref) {
      results.push({
        ref,
        version: getAttr(fullTag, "version"),
      });
    }
  }

  return results;
}

/**
 * Find all NeTEx frames in an XML document.
 *
 * Searches for all known frame types and extracts metadata including
 * id, version, type, prerequisites, and inner XML content.
 * Frames without an `id` attribute are skipped.
 *
 * @param xml - The full XML document string.
 * @param fileName - The source file name for attribution.
 * @returns Array of frame info objects.
 */
export function findAllFrames(xml: string, fileName: string): FrameInfo[] {
  const frames: FrameInfo[] = [];

  for (const frameType of FRAME_TYPES) {
    const elements = findAll(xml, frameType);
    for (const el of elements) {
      const id = getAttr(el.openTag, "id");
      if (!id) continue;

      frames.push({
        id,
        version: getAttr(el.openTag, "version"),
        type: frameType,
        fileName,
        prerequisites: parsePrerequisites(el.innerXml),
        innerXml: el.innerXml,
        line: el.line,
      });
    }
  }

  return frames;
}

/**
 * Build a prerequisite dependency graph across multiple documents.
 *
 * Collects all frames from all documents and constructs a directed graph
 * where each frame ID maps to the set of frame IDs it declares as prerequisites.
 *
 * @param documents - Array of input documents to process.
 * @returns An object containing the flat list of all frames and the
 *   prerequisite graph (frame ID → set of prerequisite frame IDs).
 */
export function buildPrerequisiteGraph(documents: DocumentInput[]): {
  frames: FrameInfo[];
  graph: Map<string, Set<string>>;
} {
  const allFrames: FrameInfo[] = [];

  for (const doc of documents) {
    const docFrames = findAllFrames(doc.xml, doc.fileName);
    allFrames.push(...docFrames);
  }

  // NOTE: duplicate frame IDs cause last-wins — the netexUniqueConstraints
  // rule (once prerequisite-aware) will flag these separately.
  const graph = new Map<string, Set<string>>();
  for (const frame of allFrames) {
    const prereqIds = new Set<string>();
    for (const prereq of frame.prerequisites) {
      prereqIds.add(prereq.ref);
    }
    graph.set(frame.id, prereqIds);
  }

  return { frames: allFrames, graph };
}
