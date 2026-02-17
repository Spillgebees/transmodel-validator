/**
 * Rule: netexKeyRefConstraints
 *
 * Parses the NeTEx XSD schema to extract `xsd:key` and `xsd:keyref`
 * constraints, then validates that every keyref in the document(s)
 * resolves to an existing key.
 *
 * This rule is **intentionally cross-document**: keyrefs in one file can
 * reference keys defined in another file within the same archive. This
 * goes beyond strict W3C XSD §3.11.4 semantics (which scope identity
 * constraints to the declaring element) by design — multi-file NeTEx
 * datasets routinely split keys and their references across files (e.g.
 * the Norwegian NeTEx profile mandates cross-file references). NeTEx
 * ships a `NoConstraint.xsd` variant precisely because per-document
 * keyref validation would reject valid multi-file references.
 *
 * **Important**: Elements with a `versionRef` attribute are skipped
 * (cross-version references are allowed to be unresolved).
 *
 * NOTE: This rule requires the XSD content to be provided via the
 * `xsdContent` config key. The orchestrator supplies it through the
 * `CROSS_DOC_RULES` mechanism in `validate.ts`.
 */

import type {
  DocumentInput,
  Rule,
  RuleConfig,
  ValidationError,
} from "@transmodel-validator/shared";
import { consistencyError, skippedInfo } from "@transmodel-validator/shared";
import { findAll, getAttr } from "../../xml/helpers.js";

const RULE_NAME = "netexKeyRefConstraints";

/** Parsed constraint definition from the XSD. */
interface Constraint {
  name: string;
  selector: string;
  fields: string[];
  refer?: string; // only on keyref — the name of the key it references
}

export const netexKeyRefConstraints: Rule = {
  name: RULE_NAME,
  displayName: "Key reference constraints",
  description:
    "Validates `xsd:keyref` constraints from the NeTEx schema across all documents \u2014 references in one file can resolve to keys in another.",
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
          "Skipped: no XSD schema content available for key-ref constraint parsing.",
        ),
      ];
    }

    const errors: ValidationError[] = [];

    // Parse constraints from XSD
    const keys = parseConstraints(xsdContent, "key");
    const keyrefs = parseConstraints(xsdContent, "keyref");

    // For each keyref, find its corresponding key definition.
    for (const keyref of keyrefs) {
      const key = keys.find((k) => k.name === keyref.refer);
      if (!key) continue; // Key definition not found in schema — skip.

      // Build the set of all key values across all documents.
      const keyValues = new Map<string, true>();

      for (const doc of documents) {
        const keyElements = findByXsdSelector(doc.xml, key.selector);
        for (const el of keyElements) {
          const mx = fieldMatrix(el, key.fields);
          const value = mx.map((v) => v[1]).join(";");
          keyValues.set(value, true);
          // Also store partial matches (any single field set to null).
          for (let i = 0; i < mx.length; i++) {
            const partial = mx.map((v, j) => (j === i ? null : v[1]));
            keyValues.set(partial.join(";"), true);
          }
        }
      }

      // Check all keyrefs across all documents.
      for (const doc of documents) {
        const refElements = findByXsdSelector(doc.xml, keyref.selector);
        for (const el of refElements) {
          // Skip elements with versionRef.
          if (getAttr(el.openTag, "versionRef") !== undefined) continue;

          const mx = fieldMatrix(el, keyref.fields);
          const fields = mx.map((v) => v[1]);
          // Skip if all fields are empty.
          if (fields.every((f) => f === null || f === undefined)) continue;

          const value = fields.join(";");
          if (!keyValues.has(value)) {
            const descriptor = mx
              .filter((v) => v[1] !== null && v[1] !== undefined)
              .map((v) => `${v[0]}="${v[1]}"`)
              .join(", ");
            errors.push(
              consistencyError(
                RULE_NAME,
                `Missing key reference for constraint \`${keyref.name}\` (${descriptor})`,
                el.line,
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
 * Parse xsd:key, xsd:keyref, or xsd:unique constraint definitions
 * from the XSD content.
 */
function parseConstraints(
  xsdContent: string,
  type: "key" | "keyref" | "unique",
): Constraint[] {
  const constraints: Constraint[] = [];

  // Find all <xsd:key>, <xsd:keyref>, or <xsd:unique> elements.
  // We also match `xs:key` variants.
  const tagRe = new RegExp(
    `<(?:xsd?):${type}(\\s[^>]*)?>([\\s\\S]*?)</(?:xsd?):${type}>`,
    "g",
  );

  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(xsdContent)) !== null) {
    const attrs = match[1] || "";
    const body = match[2];

    const name = getAttr(`<tag ${attrs}>`, "name") ?? "";
    const refer = getAttr(`<tag ${attrs}>`, "refer");

    // Parse selector
    const selectorMatch = body.match(
      /<(?:xsd?):selector\s[^>]*xpath\s*=\s*["']([^"']*)["']/,
    );
    const rawSelector = selectorMatch?.[1] ?? "";
    // Strip namespace prefixes (e.g. `netex:Foo` → `Foo`)
    const selector = rawSelector.replace(/[a-zA-Z0-9_]+:/g, "");

    // Parse fields
    const fields: string[] = [];
    const fieldRe = /<(?:xsd?):field\s[^>]*xpath\s*=\s*["']([^"']*)["']/g;
    let fieldMatch: RegExpExecArray | null;
    while ((fieldMatch = fieldRe.exec(body)) !== null) {
      fields.push(fieldMatch[1]);
    }

    constraints.push({
      name: refer ? name : name, // both use name
      selector,
      fields,
      refer: refer?.includes(":") ? refer.split(":")[1] : refer,
    });
  }

  return constraints;
}

interface FoundElement {
  openTag: string;
  innerXml: string;
  line: number;
}

/**
 * Find elements matching an XSD selector path.
 *
 * XSD selectors use XPath-like syntax (e.g. `.//ServiceFrame/lines/Line`).
 * We support:
 * - `.//Element` — find anywhere
 * - `Element/Child/...` — path navigation
 * - `.` — root
 */
function findByXsdSelector(xml: string, selector: string): FoundElement[] {
  if (!selector) return [];

  // Handle `.//Foo` — search globally for Foo
  const descendantMatch = selector.match(/^\.\/\/(.+)$/);
  if (descendantMatch) {
    const path = descendantMatch[1];
    const segments = path.split("/").filter(Boolean);
    if (segments.length === 1) {
      return findAll(xml, segments[0]).map((el) => ({
        openTag: el.openTag,
        innerXml: el.innerXml,
        line: el.line,
      }));
    }
    // Multi-segment: find all instances of the first segment, then navigate.
    return findAllByPath(xml, segments);
  }

  // Handle `Foo/Bar/Baz` — simple path from root
  const segments = selector.replace(/^\.\//, "").split("/").filter(Boolean);
  if (segments.length === 0) return [];
  return findAllByPath(xml, segments);
}

function findAllByPath(xml: string, segments: string[]): FoundElement[] {
  if (segments.length === 0) return [];

  // Find all instances of the first segment anywhere
  const firstMatches = findAll(xml, segments[0]);
  if (segments.length === 1) {
    return firstMatches.map((el) => ({
      openTag: el.openTag,
      innerXml: el.innerXml,
      line: el.line,
    }));
  }

  // Navigate remaining segments from each first match
  const results: FoundElement[] = [];
  for (const first of firstMatches) {
    let currentElements = [first.innerXml];
    for (let i = 1; i < segments.length; i++) {
      const next: string[] = [];
      for (const xml of currentElements) {
        const children = findAll(xml, segments[i]);
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

/**
 * Get field values from an element. Fields are XPath-like paths relative
 * to the element (e.g. `@id`, `Name/text()`).
 */
function fieldMatrix(
  element: FoundElement,
  fields: string[],
): [string, string | null][] {
  return fields.map((field) => {
    const value = resolveField(element, field);
    return [field, value];
  });
}

function resolveField(element: FoundElement, field: string): string | null {
  // Handle `@attrName`
  if (field.startsWith("@")) {
    return getAttr(element.openTag, field.slice(1)) ?? null;
  }

  // Handle `text()` or just text content
  if (field === "text()" || field === ".") {
    const text = element.innerXml.replace(/<[^>]+>/g, "").trim();
    return text || null;
  }

  // Handle `Child/@attr` or `Child/text()`
  const parts = field.split("/");
  if (parts.length > 1) {
    const childName = parts[0];
    const children = findAll(element.innerXml, childName);
    if (children.length === 0) return null;
    const remaining = parts.slice(1).join("/");
    return resolveField(
      {
        openTag: children[0].openTag,
        innerXml: children[0].innerXml,
        line: children[0].line,
      },
      remaining,
    );
  }

  // Simple child element text
  const children = findAll(element.innerXml, field);
  if (children.length === 0) return null;
  const text = children[0].innerXml.replace(/<[^>]+>/g, "").trim();
  return text || null;
}
