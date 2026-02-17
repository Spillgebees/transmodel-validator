/**
 * Rule: netexUniqueConstraints
 *
 * Parses the NeTEx XSD schema to extract `xsd:unique` constraints, then
 * validates that no duplicate values exist for the constrained fields
 * using a two-pass approach:
 *
 * - **Pass 1 (per-document):** Enforces uniqueness within each document
 *   independently, per W3C XSD §3.11.4 semantics. In NeTEx the unique
 *   constraints are declared on `PublicationDelivery` (one per file),
 *   so uniqueness is enforced per-document. Also accumulates element
 *   keys per-frame for cross-prerequisite checking.
 *
 * - **Pass 2 (cross-prerequisite):** Uses `buildPrerequisiteGraph()` to
 *   find frames linked via `<prerequisites>`. For each frame that
 *   declares prerequisites, checks that no key appears in both the
 *   declaring frame and its prerequisite frames.
 *
 * Cross-document referential integrity is handled separately by the
 * `netexKeyRefConstraints` rule.
 *
 * NOTE: This rule requires the XSD content to be provided via the
 * `xsdContent` config key. It remains in `CROSS_DOC_RULES` in
 * `validate.ts` so that the orchestrator supplies `xsdContent`.
 */

import type {
  DocumentInput,
  Rule,
  RuleConfig,
  ValidationError,
} from "@transmodel-validator/shared";
import { consistencyError, skippedInfo } from "@transmodel-validator/shared";
import type { FrameInfo } from "../../xml/frames.js";
import { findAllFrames } from "../../xml/frames.js";
import { findAll, getAttr } from "../../xml/helpers.js";

const RULE_NAME = "netexUniqueConstraints";

/** Parsed unique constraint from the XSD. */
interface UniqueConstraint {
  name: string;
  selector: string;
  fields: string[];
}

export const netexUniqueConstraints: Rule = {
  name: RULE_NAME,
  displayName: "Uniqueness constraints",
  description:
    "Validates `xsd:unique` constraints from the NeTEx schema \u2014 no duplicate keys within each document, and across frames linked by `<prerequisites>`.",
  formats: ["netex"],

  async run(
    documents: DocumentInput[],
    config?: RuleConfig,
  ): Promise<ValidationError[]> {
    const xsdContent = config?.xsdContent;
    if (typeof xsdContent !== "string") {
      return [
        skippedInfo(
          RULE_NAME,
          "Skipped: no XSD schema content available for unique constraint parsing.",
        ),
      ];
    }

    const errors: ValidationError[] = [];
    const constraints = parseUniqueConstraints(xsdContent);

    // Pre-cache frames per document (parsed once, reused across constraints).
    const framesPerDoc = new Map<string, FrameInfo[]>();
    for (const doc of documents) {
      framesPerDoc.set(doc.fileName, findAllFrames(doc.xml, doc.fileName));
    }

    // Build prerequisite graph once from the cached frames.
    const graph = new Map<string, Set<string>>();
    for (const docFrames of framesPerDoc.values()) {
      for (const frame of docFrames) {
        const prereqIds = new Set<string>();
        for (const prereq of frame.prerequisites) {
          prereqIds.add(prereq.ref);
        }
        graph.set(frame.id, prereqIds);
      }
    }

    // Pass 1: per-document uniqueness (existing behavior).
    // Also accumulate per-frame key sets for cross-prerequisite checking.
    // Map: constraintName → frameId → { keys, fileName }
    const frameKeySets = new Map<
      string,
      Map<string, { keys: Set<string>; fileName: string }>
    >();

    for (const constraint of constraints) {
      const perFrame = new Map<
        string,
        { keys: Set<string>; fileName: string }
      >();
      frameKeySets.set(constraint.name, perFrame);

      for (const doc of documents) {
        // NOTE: Per W3C XSD §3.11.4, identity constraints evaluate with
        // the declaring element as context node. In NeTEx the `xsd:unique`
        // constraints are declared on `PublicationDelivery` (one per file),
        // so uniqueness is enforced per-document — not across the entire
        // dataset. The `seen` map is therefore reset for each document.
        const seen = new Map<string, true>();
        const elements = findByXsdSelector(doc.xml, constraint.selector);

        for (const el of elements) {
          const key = constraint.fields
            .map((f) => resolveField(el, f))
            .join(";");

          if (seen.has(key)) {
            errors.push(
              consistencyError(
                RULE_NAME,
                `Duplicate value violates unique constraint \`${constraint.name}\` (key: \`${key}\`)`,
                el.line,
                doc.fileName,
              ),
            );
          } else {
            seen.set(key, true);
          }
        }

        // Accumulate keys per frame for cross-prerequisite checking.
        const docFrames = framesPerDoc.get(doc.fileName) ?? [];
        for (const frame of docFrames) {
          const frameElements = findByXsdSelector(
            frame.innerXml,
            constraint.selector,
          );
          const frameKeys = new Set<string>();
          for (const el of frameElements) {
            const key = constraint.fields
              .map((f) => resolveField(el, f))
              .join(";");
            frameKeys.add(key);
          }
          if (frameKeys.size > 0) {
            perFrame.set(frame.id, {
              keys: frameKeys,
              fileName: doc.fileName,
            });
          }
        }
      }
    }

    // Pass 2: cross-prerequisite uniqueness.
    // For frames linked by prerequisites, check that no key appears in both
    // the declaring frame and its prerequisite frames.
    for (const constraint of constraints) {
      const perFrame = frameKeySets.get(constraint.name);
      if (!perFrame) continue;

      for (const [frameId, prereqIds] of graph) {
        const frameData = perFrame.get(frameId);
        if (!frameData) continue;
        if (prereqIds.size === 0) continue;

        for (const prereqId of prereqIds) {
          const prereqData = perFrame.get(prereqId);
          if (!prereqData) continue;

          // Find keys that appear in both the frame and its prerequisite.
          for (const key of frameData.keys) {
            if (prereqData.keys.has(key)) {
              errors.push(
                consistencyError(
                  RULE_NAME,
                  `Duplicate value across prerequisite-linked frames violates unique constraint \`${constraint.name}\` ` +
                    `(key: \`${key}\`, frames: \`${frameId}\` and \`${prereqId}\`)`,
                  undefined,
                  frameData.fileName,
                ),
              );
            }
          }
        }
      }
    }

    return errors;
  },
};

function parseUniqueConstraints(xsdContent: string): UniqueConstraint[] {
  const constraints: UniqueConstraint[] = [];

  const tagRe = /<(?:xsd?):unique(\s[^>]*)>([\s\S]*?)<\/(?:xsd?):unique>/g;

  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(xsdContent)) !== null) {
    const attrs = match[1] || "";
    const body = match[2];

    const name = getAttr(`<tag ${attrs}>`, "name") ?? "";

    const selectorMatch = body.match(
      /<(?:xsd?):selector\s[^>]*xpath\s*=\s*["']([^"']*)["']/,
    );
    const rawSelector = selectorMatch?.[1] ?? "";
    const selector = rawSelector.replace(/[a-zA-Z0-9_]+:/g, "");

    const fields: string[] = [];
    const fieldRe = /<(?:xsd?):field\s[^>]*xpath\s*=\s*["']([^"']*)["']/g;
    let fieldMatch: RegExpExecArray | null;
    while ((fieldMatch = fieldRe.exec(body)) !== null) {
      fields.push(fieldMatch[1]);
    }

    constraints.push({ name, selector, fields });
  }

  return constraints;
}

interface FoundElement {
  openTag: string;
  innerXml: string;
  line: number;
}

function findByXsdSelector(xml: string, selector: string): FoundElement[] {
  if (!selector) return [];

  const descendantMatch = selector.match(/^\.\/\/(.+)$/);
  if (descendantMatch) {
    const segments = descendantMatch[1].split("/").filter(Boolean);
    if (segments.length === 1) {
      return findAll(xml, segments[0]).map((el) => ({
        openTag: el.openTag,
        innerXml: el.innerXml,
        line: el.line,
      }));
    }
    return findAllByPath(xml, segments);
  }

  const segments = selector.replace(/^\.\//, "").split("/").filter(Boolean);
  if (segments.length === 0) return [];
  return findAllByPath(xml, segments);
}

function findAllByPath(xml: string, segments: string[]): FoundElement[] {
  if (segments.length === 0) return [];

  const firstMatches = findAll(xml, segments[0]);
  if (segments.length === 1) {
    return firstMatches.map((el) => ({
      openTag: el.openTag,
      innerXml: el.innerXml,
      line: el.line,
    }));
  }

  const results: FoundElement[] = [];
  for (const first of firstMatches) {
    let currentElements = [first.innerXml];
    for (let i = 1; i < segments.length; i++) {
      const next: string[] = [];
      for (const currentXml of currentElements) {
        const children = findAll(currentXml, segments[i]);
        if (i === segments.length - 1) {
          results.push(
            ...children.map((el) => ({
              openTag: el.openTag,
              innerXml: el.innerXml,
              line: el.line,
            })),
          );
        } else {
          next.push(...children.map((c) => c.innerXml));
        }
      }
      currentElements = next;
    }
  }
  return results;
}

function resolveField(element: FoundElement, field: string): string | null {
  if (field.startsWith("@")) {
    return getAttr(element.openTag, field.slice(1)) ?? null;
  }

  if (field === "text()" || field === ".") {
    const text = element.innerXml.replace(/<[^>]+>/g, "").trim();
    return text || null;
  }

  const parts = field.split("/");
  if (parts.length > 1) {
    const childName = parts[0];
    const children = findAll(element.innerXml, childName);
    if (children.length === 0) return null;
    return resolveField(
      {
        openTag: children[0].openTag,
        innerXml: children[0].innerXml,
        line: children[0].line,
      },
      parts.slice(1).join("/"),
    );
  }

  const children = findAll(element.innerXml, field);
  if (children.length === 0) return null;
  const text = children[0].innerXml.replace(/<[^>]+>/g, "").trim();
  return text || null;
}
