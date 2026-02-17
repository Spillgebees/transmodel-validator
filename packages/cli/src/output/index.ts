/**
 * Output formatter dispatch.
 */

import type { ValidationResult } from "@transmodel-validator/shared";

import { formatCsv } from "./csv.js";
import { formatJson } from "./json.js";
import { formatPretty } from "./pretty.js";
import { formatXml } from "./xml.js";

export type OutputFormat = "json" | "csv" | "xml" | "pretty";

export function formatOutput(
  result: ValidationResult,
  format: OutputFormat,
): string {
  switch (format) {
    case "json":
      return formatJson(result);
    case "csv":
      return formatCsv(result);
    case "xml":
      return formatXml(result);
    case "pretty":
      return formatPretty(result);
  }
}
