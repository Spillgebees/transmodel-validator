#!/usr/bin/env node

/**
 * @transmodel-validator/cli
 *
 * CLI tool for validating NeTEx and SIRI XML files.
 */

import { validate } from "@transmodel-validator/core";
import type {
  TransmodelFormat,
  ValidateOptions,
} from "@transmodel-validator/shared";

import { type CliArgs, parseCliArgs, printUsage } from "./args.js";
import { formatOutput } from "./output/index.js";

const VERSION = "0.0.0";

async function main(): Promise<void> {
  // Strip node and script path from argv.
  const rawArgs = process.argv.slice(2);

  let args: CliArgs;
  try {
    args = parseCliArgs(rawArgs);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    console.error("Run with --help for usage information.");
    process.exit(2);
  }

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (args.version) {
    console.log(`transmodel-validator v${VERSION}`);
    process.exit(0);
  }

  if (args.files.length === 0) {
    console.error("Error: No files specified.");
    console.error("Run with --help for usage information.");
    process.exit(2);
  }

  // Build validation options from CLI args.
  const options: ValidateOptions = {};

  if (args.format !== "auto") {
    options.format = args.format as TransmodelFormat;
  }

  if (args.profile) {
    options.profile = args.profile;
  }

  if (args.schema) {
    options.schemaId = "custom";
    options.customSchemaPath = args.schema;
  }

  if (args.rules) {
    options.rules = args.rules;
  }

  // Log start (unless silent).
  if (!args.silent && args.output === "pretty") {
    const fileWord = args.files.length === 1 ? "file" : "files";
    console.error(`Validating ${args.files.length} ${fileWord}...`);
  }

  try {
    const result = await validate(args.files, options);

    // Format and output results.
    const output = formatOutput(result, args.output);
    console.log(output);

    // Exit code: 0 = all passed, 1 = some failed.
    process.exit(result.failedFiles > 0 ? 1 : 0);
  } catch (err) {
    if (!args.silent) {
      console.error(
        `Validation error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    process.exit(2);
  }
}

main();
