/**
 * Lightweight XML query helpers for business rules.
 *
 * Uses regex-based and string-based XML navigation for common patterns
 * found in NeTEx/SIRI documents. This avoids pulling in a full DOM parser
 * for business rules that just need to find elements and attributes.
 *
 * For XSD validation we use libxml2-wasm which has its own parser.
 *
 * NOTE: This is intentionally simple. NeTEx/SIRI documents follow
 * predictable structures, and the business rules only need basic queries.
 * If we ever need full XPath, we can swap in libxml2-wasm's XPath support.
 */

export interface XmlElement {
  /** Local name of the element (without namespace prefix). */
  localName: string;
  /** The full opening tag text. */
  openTag: string;
  /** The inner content between open and close tags. */
  innerXml: string;
  /** The full element text (open tag + content + close tag). */
  outerXml: string;
  /** 1-based line number of the opening tag. */
  line: number;
  /** Byte offset of the start of this element in the source. */
  offset: number;
}

/**
 * Compute the base line offset for content inside an element's inner XML.
 *
 * When searching within an element's `innerXml` fragment, child elements
 * have fragment-relative line numbers. Use this value as `baseLine` when
 * calling `findChildren` or `findAll` on the fragment to get absolute
 * line numbers relative to the original document.
 *
 * @param element - The parent element whose inner XML will be searched.
 * @returns A 0-based line offset to add to fragment-relative line numbers.
 */
export function innerBaseLine(element: XmlElement): number {
  return element.line - 1 + countNewlines(element.openTag);
}

/**
 * Compute the byte offset where an element's inner XML content starts
 * in the original document.
 *
 * @param element - The parent element.
 * @returns The absolute byte offset of the inner XML start.
 */
export function innerBaseOffset(element: XmlElement): number {
  return element.offset + element.openTag.length;
}

/** Count the number of newline characters in a string. */
function countNewlines(str: string): number {
  let n = 0;
  for (const ch of str) {
    if (ch === "\n") n++;
  }
  return n;
}

/**
 * Count the number of newlines before a given offset in a string.
 * Returns a 1-based line number.
 */
export function lineAt(xml: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < xml.length; i++) {
    if (xml[i] === "\n") line++;
  }
  return line;
}

/**
 * Get the value of an attribute from an opening tag string.
 *
 * @returns The attribute value, or `undefined` if not found.
 */
export function getAttr(openTag: string, name: string): string | undefined {
  // Match both single and double quoted attribute values.
  const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`);
  const m = openTag.match(re);
  return m ? m[1] : undefined;
}

/**
 * Find all top-level child elements with a given local name inside an
 * XML fragment. "Top-level" means direct children — does not recurse
 * into nested elements of the same name.
 *
 * @param xml - The XML string to search (can be a full document or fragment).
 * @param localName - The element local name to find.
 * @param baseOffset - Byte offset of the fragment start in the original
 *   document. Added to each element's `offset` to produce absolute offsets.
 * @param baseLine - 0-based line offset of the fragment start in the
 *   original document. Added to each element's fragment-relative line
 *   number to produce absolute line numbers. Use `innerBaseLine(parent)`
 *   when searching inside a parent element's `innerXml`.
 */
export function findChildren(
  xml: string,
  localName: string,
  baseOffset = 0,
  baseLine = 0,
): XmlElement[] {
  const results: XmlElement[] = [];

  // Match opening tags — handles self-closing and regular elements.
  // We need to account for namespace prefixes: `<prefix:Name` or `<Name`.
  const openTagRe = new RegExp(
    `<(?:[a-zA-Z0-9_]+:)?${escapeRegex(localName)}(\\s[^>]*)?>`,
    "g",
  );

  let match: RegExpExecArray | null;
  while ((match = openTagRe.exec(xml)) !== null) {
    const tagStart = match.index;
    const openTag = match[0];

    // Self-closing tag
    if (openTag.endsWith("/>")) {
      results.push({
        localName,
        openTag,
        innerXml: "",
        outerXml: openTag,
        line: lineAt(xml, tagStart) + baseLine,
        offset: tagStart + baseOffset,
      });
      continue;
    }

    // Find the matching close tag, accounting for nesting.
    const closeTag = findCloseTag(xml, localName, tagStart + openTag.length);
    if (closeTag === -1) continue; // Malformed XML — skip

    const _closeTagStr = `</${localName}>`;
    // Also check for prefixed close tags
    const closeEnd = xml.indexOf(">", closeTag) + 1;
    const innerXml = xml.slice(tagStart + openTag.length, closeTag);
    const outerXml = xml.slice(tagStart, closeEnd);

    results.push({
      localName,
      openTag,
      innerXml,
      outerXml,
      line: lineAt(xml, tagStart) + baseLine,
      offset: tagStart + baseOffset,
    });

    // Move past this element to avoid matching nested instances.
    openTagRe.lastIndex = closeEnd;
  }

  return results;
}

/**
 * Find all elements matching a given local name anywhere in the document
 * (depth-first search).
 *
 * @param xml - The XML string to search (can be a full document or fragment).
 * @param localName - The element local name to find.
 * @param baseOffset - Byte offset of the fragment start in the original
 *   document. Added to each element's `offset` to produce absolute offsets.
 * @param baseLine - 0-based line offset of the fragment start in the
 *   original document. Added to each element's fragment-relative line
 *   number to produce absolute line numbers.
 */
export function findAll(
  xml: string,
  localName: string,
  baseOffset = 0,
  baseLine = 0,
): XmlElement[] {
  const results: XmlElement[] = [];

  const openTagRe = new RegExp(
    `<(?:[a-zA-Z0-9_]+:)?${escapeRegex(localName)}(\\s[^>]*)?>`,
    "g",
  );

  let match: RegExpExecArray | null;
  while ((match = openTagRe.exec(xml)) !== null) {
    const tagStart = match.index;
    const openTag = match[0];

    if (openTag.endsWith("/>")) {
      results.push({
        localName,
        openTag,
        innerXml: "",
        outerXml: openTag,
        line: lineAt(xml, tagStart) + baseLine,
        offset: tagStart + baseOffset,
      });
      continue;
    }

    const closeTag = findCloseTag(xml, localName, tagStart + openTag.length);
    if (closeTag === -1) continue;

    const closeEnd = xml.indexOf(">", closeTag) + 1;
    const innerXml = xml.slice(tagStart + openTag.length, closeTag);
    const outerXml = xml.slice(tagStart, closeEnd);

    results.push({
      localName,
      openTag,
      innerXml,
      outerXml,
      line: lineAt(xml, tagStart) + baseLine,
      offset: tagStart + baseOffset,
    });
  }

  return results;
}

/**
 * Get the text content of the first child element with a given local name.
 * Returns `undefined` if not found.
 */
export function getChildText(
  xml: string,
  localName: string,
): string | undefined {
  const children = findChildren(xml, localName);
  if (children.length === 0) return undefined;
  // Return the text content (strip any nested tags).
  return stripTags(children[0].innerXml).trim();
}

/**
 * Navigate a `/`-separated path of element names and return all matches
 * at the final level.
 *
 * Example: `"dataObjects/CompositeFrame/frames/ServiceFrame/lines/Line"`
 *
 * Each segment narrows into the `innerXml` of matching elements.
 */
export function navigatePath(
  xml: string,
  path: string,
  baseOffset = 0,
  baseLine = 0,
): XmlElement[] {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return [];

  let currentFragments = [{ xml, offset: baseOffset, line: baseLine }];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const nextFragments: { xml: string; offset: number; line: number }[] = [];

    for (const frag of currentFragments) {
      const children = findChildren(frag.xml, segment, frag.offset, frag.line);
      for (const child of children) {
        if (i < segments.length - 1) {
          // Intermediate segment — descend into innerXml.
          nextFragments.push({
            xml: child.innerXml,
            offset: innerBaseOffset(child),
            line: innerBaseLine(child),
          });
        } else {
          // Final segment — these are our results. But we need them
          // as elements, not fragments.
          nextFragments.push({
            xml: child.outerXml,
            offset: child.offset,
            line: child.line - 1,
          });
        }
      }
    }

    if (i === segments.length - 1) {
      // Re-parse the final fragments to return proper XmlElements.
      const results: XmlElement[] = [];
      for (const frag of currentFragments) {
        results.push(
          ...findChildren(frag.xml, segment, frag.offset, frag.line),
        );
      }
      return results;
    }

    currentFragments = nextFragments;
  }

  return [];
}

/**
 * Find the position of the matching close tag, accounting for nested
 * elements with the same local name.
 *
 * @returns The index of the `<` in the close tag, or -1 if not found.
 */
function findCloseTag(
  xml: string,
  localName: string,
  searchFrom: number,
): number {
  const openRe = new RegExp(
    `<(?:[a-zA-Z0-9_]+:)?${escapeRegex(localName)}(\\s[^>]*)?>`,
    "g",
  );
  const closeRe = new RegExp(
    `</(?:[a-zA-Z0-9_]+:)?${escapeRegex(localName)}\\s*>`,
    "g",
  );

  let depth = 1;
  let pos = searchFrom;

  while (depth > 0 && pos < xml.length) {
    openRe.lastIndex = pos;
    closeRe.lastIndex = pos;

    const nextOpen = openRe.exec(xml);
    const nextClose = closeRe.exec(xml);

    if (!nextClose) return -1; // No matching close tag.

    if (nextOpen && nextOpen.index < nextClose.index) {
      // Skip self-closing tags
      if (!nextOpen[0].endsWith("/>")) {
        depth++;
      }
      pos = nextOpen.index + nextOpen[0].length;
    } else {
      depth--;
      if (depth === 0) return nextClose.index;
      pos = nextClose.index + nextClose[0].length;
    }
  }

  return -1;
}

/** Strip XML tags from a string, leaving only text content. */
function stripTags(xml: string): string {
  return xml.replace(/<[^>]+>/g, "");
}

/** Escape special regex characters in a string. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
