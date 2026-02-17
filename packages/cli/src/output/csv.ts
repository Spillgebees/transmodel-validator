/**
 * CSV output formatter.
 *
 * Outputs one row per error, with columns:
 * file, format, rule, severity, category, line, column, message
 */

import type { ValidationResult } from "@transmodel-validator/shared";

const HEADER = "file,format,rule,severity,category,line,column,message";

export function formatCsv(result: ValidationResult): string {
  const rows: string[] = [HEADER];

  for (const file of result.files) {
    if (file.errors.length === 0) {
      // Include a row even for passing files so the output is complete.
      rows.push(
        csvRow([
          file.fileName,
          file.format,
          "",
          "pass",
          "",
          "",
          "",
          "No errors",
        ]),
      );
      continue;
    }

    for (const err of file.errors) {
      rows.push(
        csvRow([
          file.fileName,
          file.format,
          err.rule ?? err.source,
          err.severity,
          err.category,
          err.line?.toString() ?? "",
          err.column?.toString() ?? "",
          err.message,
        ]),
      );
    }
  }

  return rows.join("\n");
}

/** Escape and quote a CSV field. */
function csvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
