/**
 * JSON output formatter.
 */

import type { ValidationResult } from "@transmodel-validator/core";

export function formatJson(result: ValidationResult): string {
  return JSON.stringify(result, null, 2);
}
