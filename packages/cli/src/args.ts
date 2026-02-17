/**
 * CLI argument parsing using Node.js built-in parseArgs.
 */

import { parseArgs } from "node:util";

export interface CliArgs {
  files: string[];
  format: "auto" | "netex" | "siri";
  profile?: string;
  schema?: string;
  rules?: string[];
  output: "json" | "csv" | "xml" | "pretty";
  logLevel: "debug" | "info" | "warn" | "error";
  silent: boolean;
  help: boolean;
  version: boolean;
}

const USAGE = `
transmodel-validator — Validate NeTEx and SIRI XML files

Usage:
  transmodel-validator validate [files...] [options]
  transmodel-validator [files...] [options]

Options:
  --format <type>      Input format: auto, netex, siri (default: auto)
  --profile <name>     Validation profile (default: depends on format)
                        NeTEx: netex-fast-v1.2, netex-full-v1.2, epip-v1.1.2,
                               netex-schema-only-v1.2, netex-rules-only
                        SIRI:  siri-v2.2, siri-v2.1, siri-schema-only-v2.2,
                               siri-rules-only
  --schema <path>      Custom XSD schema path (zip or directory)
  --rules <rule,...>   Comma-separated rule list (overrides profile)
  --output <format>    Output format: json, csv, xml, pretty (default: pretty)
  --log-level <level>  Log level: debug, info, warn, error (default: warn)
  --silent             Suppress all output except results
  --help               Show this help message
  --version            Show version

Examples:
  transmodel-validator validate data.xml
  transmodel-validator *.xml --profile netex-full-v1.2 --output json
  transmodel-validator siri-feed.xml --format siri
  transmodel-validator archive.zip --rules everyLineIsReferenced,everyStopPlaceHasAName
`.trim();

export function printUsage(): void {
  console.log(USAGE);
}

export function parseCliArgs(argv: string[]): CliArgs {
  // Strip "validate" subcommand if present.
  const args = argv[0] === "validate" ? argv.slice(1) : argv;

  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      format: { type: "string", default: "auto" },
      profile: { type: "string" },
      schema: { type: "string" },
      rules: { type: "string" },
      output: { type: "string", short: "o", default: "pretty" },
      "log-level": { type: "string", default: "warn" },
      silent: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
  });

  const format = values.format as string;
  if (!["auto", "netex", "siri"].includes(format)) {
    throw new Error(
      `Invalid format: "${format}". Must be one of: auto, netex, siri`,
    );
  }

  const output = values.output as string;
  if (!["json", "csv", "xml", "pretty"].includes(output)) {
    throw new Error(
      `Invalid output format: "${output}". Must be one of: json, csv, xml, pretty`,
    );
  }

  const logLevel = values["log-level"] as string;
  if (!["debug", "info", "warn", "error"].includes(logLevel)) {
    throw new Error(
      `Invalid log level: "${logLevel}". Must be one of: debug, info, warn, error`,
    );
  }

  const rulesStr = values.rules as string | undefined;
  const rules = rulesStr
    ? rulesStr
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean)
    : undefined;

  return {
    files: positionals,
    format: format as CliArgs["format"],
    profile: values.profile as string | undefined,
    schema: values.schema as string | undefined,
    rules,
    output: output as CliArgs["output"],
    logLevel: logLevel as CliArgs["logLevel"],
    silent: values.silent as boolean,
    help: values.help as boolean,
    version: values.version as boolean,
  };
}
