/**
 * Error factory functions for creating structured validation errors.
 *
 * Mirrors the Greenlight error types:
 * - ConsistencyError → structural / referential integrity issues
 * - QualityError     → data quality issues (e.g. distances)
 * - NotFoundError    → expected element missing entirely
 * - GeneralError     → catch-all
 */

import type { ValidationError } from "./types.js";

export function consistencyError(
  rule: string,
  message: string,
  line?: number,
  fileName?: string,
): ValidationError {
  return {
    message,
    source: "rule",
    severity: "error",
    category: "consistency",
    rule,
    line,
    fileName,
  };
}

export function qualityError(
  rule: string,
  message: string,
  line?: number,
  fileName?: string,
): ValidationError {
  return {
    message,
    source: "rule",
    severity: "warning",
    category: "quality",
    rule,
    line,
    fileName,
  };
}

export function notFoundError(
  rule: string,
  message: string,
  line?: number,
  fileName?: string,
): ValidationError {
  return {
    message,
    source: "rule",
    severity: "error",
    category: "not-found",
    rule,
    line,
    fileName,
  };
}

export function generalError(
  rule: string,
  message: string,
  line?: number,
  fileName?: string,
): ValidationError {
  return {
    message,
    source: "rule",
    severity: "error",
    category: "general",
    rule,
    line,
    fileName,
  };
}

export function skippedInfo(
  rule: string,
  message: string,
  line?: number,
  fileName?: string,
): ValidationError {
  return {
    message,
    source: "rule",
    severity: "info",
    category: "skipped",
    rule,
    line,
    fileName,
  };
}

export function xsdError(
  message: string,
  line?: number,
  column?: number,
): ValidationError {
  return {
    message: formatXsdMessage(message),
    source: "xsd",
    severity: "error",
    category: "general",
    line,
    column,
  };
}

/**
 * Transform a raw libxml2 XSD validation message into inline-markdown.
 *
 * Handles the most common patterns:
 * - Strip namespace URIs in braces: `{http://...}` → removed
 * - Element references: `Element 'Foo'` → `Element \`Foo\``
 * - Attribute references: `attribute 'bar'` → `attribute \`bar\``
 * - Value references: `value 'baz'` → `value \`baz\``
 * - Type references: `type 'MyType'` → `type \`MyType\``
 * - Expected-list: `Expected is one of ( A, B, C ).` → `Expected is one of \`A\`, \`B\`, \`C\`.`
 * - Expected-single: `Expected is ( A ).` → `Expected is \`A\`.`
 *
 * @param raw - The raw libxml2 error message.
 * @returns The message with inline markdown formatting.
 */
export function formatXsdMessage(raw: string): string {
  let msg = raw;

  // Strip namespace URIs in braces: {http://...}
  msg = msg.replace(/\{https?:\/\/[^}]+\}/g, "");

  // Wrap single-quoted identifiers in backticks for known prefixes.
  // Matches: Element 'X', attribute 'X', value 'X', type 'X'
  msg = msg.replace(
    /\b(Element|attribute|value|type)\s+'([^']+)'/gi,
    (_, prefix, name) => `${prefix} \`${name}\``,
  );

  // Handle "Expected is one of ( A, B, C )." — wrap each item in backticks.
  msg = msg.replace(
    /Expected is one of \(\s*([^)]+)\)/g,
    (_, items: string) => {
      const formatted = items
        .split(",")
        .map((s) => `\`${s.trim()}\``)
        .join(", ");
      return `Expected is one of ${formatted}`;
    },
  );

  // Handle "Expected is ( A )." — single expected element.
  msg = msg.replace(
    /Expected is \(\s*([^)]+)\)/g,
    (_, item: string) => `Expected is \`${item.trim()}\``,
  );

  return msg;
}
