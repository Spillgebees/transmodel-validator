/**
 * CLI integration tests.
 *
 * Tests the CLI by spawning it as a child process and checking
 * stdout, stderr, and exit codes.
 */

import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const CLI = join(import.meta.dirname, "..", "dist", "index.js");
const FIXTURES = join(import.meta.dirname, "fixtures");

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function run(...args: string[]): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execFileAsync("node", [CLI, ...args]);
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout: string; stderr: string; code: number };
    return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", exitCode: e.code };
  }
}

// =========================================================================
// Help & version
// =========================================================================

describe("CLI basics", () => {
  it("shows help with --help", async () => {
    const result = await run("--help");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("transmodel-validator");
    expect(result.stdout).toContain("--format");
    expect(result.stdout).toContain("--profile");
  });

  it("shows version with --version", async () => {
    const result = await run("--version");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("transmodel-validator v");
  });

  it("exits with code 2 when no files given", async () => {
    const result = await run();
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("No files specified");
  });
});

// =========================================================================
// Validation
// =========================================================================

describe("CLI validation", () => {
  it("passes a valid NeTEx file (rules only)", async () => {
    const result = await run(
      join(FIXTURES, "valid-netex.xml"),
      "--profile",
      "netex-rules-only",
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("PASS");
    expect(result.stdout).toContain("valid-netex.xml");
  });

  it("fails an invalid NeTEx file (rules only)", async () => {
    const result = await run(
      join(FIXTURES, "invalid-netex.xml"),
      "--profile",
      "netex-rules-only",
    );
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("FAIL");
    expect(result.stdout).toContain("everyLineIsReferenced");
  });

  it("validates multiple files", async () => {
    const result = await run(
      join(FIXTURES, "valid-netex.xml"),
      join(FIXTURES, "invalid-netex.xml"),
      "--profile",
      "netex-rules-only",
    );
    expect(result.exitCode).toBe(1); // At least one failure
    expect(result.stdout).toContain("PASS");
    expect(result.stdout).toContain("FAIL");
  });

  it("supports the validate subcommand", async () => {
    const result = await run(
      "validate",
      join(FIXTURES, "valid-netex.xml"),
      "--profile",
      "netex-rules-only",
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("PASS");
  });

  it("allows selecting specific rules", async () => {
    const result = await run(
      join(FIXTURES, "invalid-netex.xml"),
      "--profile",
      "netex-rules-only",
      "--rules",
      "everyLineIsReferenced",
    );
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("everyLineIsReferenced");
    // Other rules should NOT appear
    expect(result.stdout).not.toContain("everyStopPlaceHasAName");
  });
});

// =========================================================================
// Output formats
// =========================================================================

describe("CLI output formats", () => {
  it("outputs JSON", async () => {
    const result = await run(
      join(FIXTURES, "valid-netex.xml"),
      "--profile",
      "netex-rules-only",
      "--output",
      "json",
    );
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.totalFiles).toBe(1);
    expect(parsed.files[0].passed).toBe(true);
  });

  it("outputs CSV", async () => {
    const result = await run(
      join(FIXTURES, "invalid-netex.xml"),
      "--profile",
      "netex-rules-only",
      "--output",
      "csv",
    );
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("file,format,rule");
    expect(result.stdout).toContain("everyLineIsReferenced");
  });

  it("outputs XML", async () => {
    const result = await run(
      join(FIXTURES, "valid-netex.xml"),
      "--profile",
      "netex-rules-only",
      "--output",
      "xml",
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("<ValidationReport");
    expect(result.stdout).toContain('passed="true"');
  });
});

// =========================================================================
// Error handling
// =========================================================================

describe("CLI error handling", () => {
  it("exits with code 2 for invalid format", async () => {
    const result = await run(
      join(FIXTURES, "valid-netex.xml"),
      "--format",
      "invalid",
    );
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid format");
  });

  it("exits with code 2 for invalid output format", async () => {
    const result = await run(
      join(FIXTURES, "valid-netex.xml"),
      "--output",
      "yaml",
    );
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Invalid output format");
  });

  it("exits with code 2 for nonexistent file", async () => {
    const result = await run(
      "nonexistent.xml",
      "--profile",
      "netex-rules-only",
    );
    expect(result.exitCode).toBe(2);
  });
});
