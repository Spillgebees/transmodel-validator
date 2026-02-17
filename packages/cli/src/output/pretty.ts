/**
 * Pretty-printed terminal output formatter.
 */

import type { ValidationResult } from "@transmodel-validator/core";

// ANSI color codes
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const _CYAN = "\x1b[36m";

export function formatPretty(result: ValidationResult): string {
  const lines: string[] = [];

  // Header
  lines.push(
    `${BOLD}transmodel-validator${RESET}  ${DIM}${result.totalFiles} file(s) validated in ${result.durationMs}ms${RESET}`,
  );
  lines.push("");

  // Per-file results
  for (const file of result.files) {
    const status = file.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
    const errorCount = file.errors.length;
    const suffix =
      errorCount > 0
        ? `  ${DIM}(${errorCount} error${errorCount !== 1 ? "s" : ""})${RESET}`
        : "";

    lines.push(
      `  ${status}  ${file.fileName} ${DIM}[${file.format}]${RESET}${suffix}`,
    );

    // Show errors for failed files
    if (!file.passed) {
      for (const err of file.errors) {
        const location = err.line ? `${DIM}:${err.line}${RESET}` : "";
        const severity =
          err.severity === "warning"
            ? `${YELLOW}warning${RESET}`
            : `${RED}error${RESET}`;
        const source = err.rule
          ? `${DIM}[${err.rule}]${RESET}`
          : `${DIM}[${err.source}]${RESET}`;

        lines.push(`    ${severity} ${source} ${err.message}${location}`);
      }
      lines.push("");
    }
  }

  // Summary
  lines.push("");
  if (result.failedFiles === 0) {
    lines.push(
      `${GREEN}${BOLD}All ${result.totalFiles} file(s) passed.${RESET}`,
    );
  } else {
    lines.push(
      `${RED}${BOLD}${result.failedFiles} of ${result.totalFiles} file(s) failed${RESET} ${DIM}(${result.totalErrors} total error${result.totalErrors !== 1 ? "s" : ""})${RESET}`,
    );
  }

  return lines.join("\n");
}
