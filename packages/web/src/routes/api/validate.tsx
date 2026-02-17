/**
 * SSE validation endpoint.
 *
 * Accepts a POST with raw files (FormData) + config, prepares documents
 * (extracting archives), runs `validateDocuments` with an `onProgress`
 * callback, and streams progress events back to the client via SSE.
 *
 * Files are sent as binary FormData entries — the server reads them as
 * text or buffers directly, avoiding the client-side text decode + JSON
 * re-encode round-trip that the previous JSON-based approach required.
 *
 * Event types:
 *   - `prepared` — file preparation complete, includes total document count
 *   - `progress` — phase transition (rules, xsd, file-done, cross-doc, complete)
 *   - `done`     — final aggregate result + XML snippets + schema path
 *   - `error`    — fatal error
 */

import { createFileRoute } from "@tanstack/react-router";

const debug =
  typeof process !== "undefined" &&
  (process.env.DEBUG ?? "")
    .split(",")
    .some((d) => d.trim() === "api/validate" || d.trim() === "*");
const log = debug
  ? (...args: unknown[]) => console.log("[api/validate]", ...args)
  : () => {};

export const Route = createFileRoute("/api/validate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const formData = await request.formData();
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
          async start(controller) {
            const send = (event: string, data: unknown) => {
              controller.enqueue(
                encoder.encode(
                  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
                ),
              );
            };

            try {
              const { validateDocuments } = await import(
                "@transmodel-validator/core"
              );
              const { extractXmlFromArchive } = await import(
                "@transmodel-validator/core/archive"
              );

              const tStart = performance.now();

              const schemaId = formData.get("schemaId") as string;
              const format = (formData.get("format") as string) || "auto";
              const rulesRaw = formData.get("rules") as string | null;
              const rules = rulesRaw
                ? (JSON.parse(rulesRaw) as string[])
                : undefined;
              const customSchemaBase64 = formData.get("customSchemaBase64") as
                | string
                | null;
              const customSchemaFileName = formData.get(
                "customSchemaFileName",
              ) as string | null;
              const customSchemaRootXsd = formData.get("customSchemaRootXsd") as
                | string
                | null;

              // Collect uploaded files from FormData.
              const uploadedFiles = formData.getAll("files") as File[];

              // Prepare documents: read XML files as text, extract archives.
              const ARCHIVE_EXTENSIONS = [
                ".zip",
                ".gz",
                ".tar",
                ".tgz",
                ".tbz2",
                ".tar.gz",
                ".tar.bz2",
              ];
              const isArchive = (name: string) => {
                const lower = name.toLowerCase();
                return ARCHIVE_EXTENSIONS.some((ext) => lower.endsWith(ext));
              };

              const documents: Array<{ fileName: string; xml: string }> = [];
              const archiveTempDirs: string[] = [];

              for (const file of uploadedFiles) {
                if (isArchive(file.name)) {
                  const { writeFile, mkdir } = await import("node:fs/promises");
                  const { tmpdir } = await import("node:os");
                  const { join } = await import("node:path");

                  const tempDir = join(
                    tmpdir(),
                    `tv-web-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                  );
                  await mkdir(tempDir, { recursive: true });
                  archiveTempDirs.push(tempDir);

                  const tempPath = join(tempDir, file.name);
                  const buffer = Buffer.from(await file.arrayBuffer());
                  await writeFile(tempPath, buffer);
                  const extracted = await extractXmlFromArchive(tempPath);
                  documents.push(...extracted);
                } else {
                  documents.push({
                    fileName: file.name,
                    xml: await file.text(),
                  });
                }
              }

              const tPrepared = performance.now();
              log(
                `file preparation: ${(tPrepared - tStart).toFixed(1)}ms (${documents.length} docs)`,
              );

              // Tell the client how many documents we have after extraction.
              send("prepared", { totalDocuments: documents.length });

              if (documents.length === 0) {
                send("done", {
                  result: {
                    files: [],
                    totalFiles: 0,
                    passedFiles: 0,
                    failedFiles: 0,
                    totalErrors: 0,
                    durationMs: 0,
                  },
                  xmlSnippets: {},
                });
                controller.close();
                return;
              }

              // Resolve custom schema (if any).
              let customSchemaPath: string | undefined;
              let customSchemaTempDir: string | undefined;

              if (customSchemaBase64 && customSchemaFileName) {
                const { writeFile, mkdir } = await import("node:fs/promises");
                const { tmpdir } = await import("node:os");
                const { join } = await import("node:path");

                customSchemaTempDir = join(
                  tmpdir(),
                  `tv-schema-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                );
                await mkdir(customSchemaTempDir, { recursive: true });
                const uploadedPath = join(
                  customSchemaTempDir,
                  customSchemaFileName,
                );
                const buffer = Buffer.from(customSchemaBase64, "base64");
                await writeFile(uploadedPath, buffer);

                if (customSchemaFileName.toLowerCase().endsWith(".zip")) {
                  const extractDir = join(customSchemaTempDir, "extracted");
                  await mkdir(extractDir, { recursive: true });
                  const { execFile } = await import("node:child_process");
                  const { promisify } = await import("node:util");
                  const execFileAsync = promisify(execFile);
                  await execFileAsync("unzip", [
                    "-o",
                    "-q",
                    uploadedPath,
                    "-d",
                    extractDir,
                  ]);

                  if (!customSchemaRootXsd) {
                    send("error", {
                      message:
                        "A root XSD file must be selected for zip schema archives.",
                    });
                    controller.close();
                    return;
                  }

                  const candidatePath = join(extractDir, customSchemaRootXsd);
                  const { existsSync } = await import("node:fs");
                  if (!existsSync(candidatePath)) {
                    send("error", {
                      message: `Selected root XSD "${customSchemaRootXsd}" not found in the archive.`,
                    });
                    controller.close();
                    return;
                  }
                  customSchemaPath = candidatePath;
                } else {
                  customSchemaPath = uploadedPath;
                }
              }

              const isCustom = !!customSchemaPath;
              const isNone = schemaId === "none";

              const tSchemaStart = performance.now();

              let resolvedSchemaPath: string | undefined;
              if (isCustom) {
                resolvedSchemaPath = customSchemaFileName ?? undefined;
                log(`custom schema: ${customSchemaPath}`);
                if (customSchemaPath) {
                  const tWarmStart = performance.now();
                  const core = await import("@transmodel-validator/core");
                  await core.warmUpValidator(customSchemaPath);
                  log(
                    `warmUpValidator (custom): ${(performance.now() - tWarmStart).toFixed(1)}ms`,
                  );
                }
              } else if (!isNone && schemaId && schemaId !== "custom") {
                try {
                  const core = await import("@transmodel-validator/core");
                  resolvedSchemaPath = await core.resolveEntryXsd(
                    schemaId as Parameters<typeof core.resolveEntryXsd>[0],
                  );
                  log(`resolved schema: ${resolvedSchemaPath}`);
                  const tWarmStart = performance.now();
                  await core.warmUpValidator(resolvedSchemaPath);
                  log(
                    `warmUpValidator: ${(performance.now() - tWarmStart).toFixed(1)}ms`,
                  );
                } catch {
                  // Non-critical — validation will still work (just slower).
                }
              }

              const tSchemaEnd = performance.now();
              log(
                `schema resolve + warm-up: ${(tSchemaEnd - tSchemaStart).toFixed(1)}ms`,
              );

              // Run validation with progress streaming.
              const tValStart = performance.now();
              const result = await validateDocuments(documents, {
                rules,
                format:
                  format === "auto" ? undefined : (format as "netex" | "siri"),
                ...(isCustom
                  ? { schemaId: "custom" as const, customSchemaPath }
                  : isNone
                    ? { skipXsd: true }
                    : {
                        schemaId: schemaId as Parameters<
                          typeof validateDocuments
                        >[1]["schemaId"],
                      }),
                onProgress: (event) => {
                  send("progress", event);
                },
              });
              const tValEnd = performance.now();
              log(`validateDocuments: ${(tValEnd - tValStart).toFixed(1)}ms`);
              log(`total: ${(tValEnd - tStart).toFixed(1)}ms`);

              // Extract sparse XML snippets around errors.
              const CONTEXT = 3;
              const xmlSnippets: Record<string, Record<number, string>> = {};
              const docLinesMap = new Map<string, string[]>();
              for (const doc of documents) {
                docLinesMap.set(doc.fileName, doc.xml.split("\n"));
              }

              for (const fileResult of result.files) {
                const lines = docLinesMap.get(fileResult.fileName);
                if (!lines) continue;

                const errorLineNums = fileResult.errors
                  .map((e) => e.line)
                  .filter((l): l is number => l !== undefined);

                if (errorLineNums.length === 0) continue;

                const includeLines = new Set<number>();
                for (const ln of errorLineNums) {
                  for (let j = ln - CONTEXT; j <= ln + CONTEXT; j++) {
                    if (j >= 1 && j <= lines.length) {
                      includeLines.add(j);
                    }
                  }
                }

                const snippet: Record<number, string> = {};
                for (const ln of includeLines) {
                  snippet[ln] = lines[ln - 1];
                }
                xmlSnippets[fileResult.fileName] = snippet;
              }

              send("done", { result, xmlSnippets, resolvedSchemaPath });

              // Clean up temp directories.
              const { rm } = await import("node:fs/promises");
              for (const dir of [
                ...archiveTempDirs,
                ...(customSchemaTempDir ? [customSchemaTempDir] : []),
              ]) {
                try {
                  await rm(dir, { recursive: true });
                } catch {
                  // Ignore cleanup errors.
                }
              }
            } catch (err) {
              send("error", {
                message: err instanceof Error ? err.message : String(err),
              });
            }

            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
