/**
 * XML output formatter.
 *
 * Outputs results as a simple XML report.
 */

import type { ValidationResult } from "@transmodel-validator/shared";

export function formatXml(result: ValidationResult): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<ValidationReport totalFiles="${result.totalFiles}" passed="${result.passedFiles}" failed="${result.failedFiles}" errors="${result.totalErrors}" durationMs="${result.durationMs}">`,
  );

  for (const file of result.files) {
    lines.push(
      `  <File name="${escapeXml(file.fileName)}" format="${file.format}" passed="${file.passed}" errors="${file.errors.length}">`,
    );

    for (const err of file.errors) {
      const attrs = [
        `source="${err.source}"`,
        `severity="${err.severity}"`,
        `category="${err.category}"`,
        err.rule ? `rule="${escapeXml(err.rule)}"` : "",
        err.line != null ? `line="${err.line}"` : "",
        err.column != null ? `column="${err.column}"` : "",
      ]
        .filter(Boolean)
        .join(" ");

      lines.push(`    <Error ${attrs}>${escapeXml(err.message)}</Error>`);
    }

    lines.push("  </File>");
  }

  lines.push("</ValidationReport>");

  return lines.join("\n");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
