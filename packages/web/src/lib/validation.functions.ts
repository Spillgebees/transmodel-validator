/**
 * Server functions for validation-related operations.
 *
 * These run on the server and are callable from client components.
 */

import { createServerFn } from "@tanstack/react-start";

/**
 * List all .xsd files inside an uploaded zip archive.
 * Returns relative paths so the user can pick the root/entry XSD.
 */
export const listSchemaXsdFiles = createServerFn({ method: "POST" })
  .inputValidator((data: { base64: string; fileName: string }) => data)
  .handler(async ({ data }) => {
    const { writeFile, mkdir, readdir, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join, relative } = await import("node:path");

    const tempDir = join(
      tmpdir(),
      `tv-schema-list-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(tempDir, { recursive: true });

    try {
      const uploadedPath = join(tempDir, data.fileName);
      const buffer = Buffer.from(data.base64, "base64");
      await writeFile(uploadedPath, buffer);

      const extractDir = join(tempDir, "extracted");
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

      // Recursively find all .xsd files.
      const xsdFiles: string[] = [];
      const walk = async (dir: string): Promise<void> => {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile() && entry.name.endsWith(".xsd")) {
            xsdFiles.push(relative(extractDir, fullPath));
          }
        }
      };
      await walk(extractDir);

      // Sort for predictable display: shorter paths first, then alphabetically.
      xsdFiles.sort((a, b) => {
        const depthA = a.split("/").length;
        const depthB = b.split("/").length;
        if (depthA !== depthB) return depthA - depthB;
        return a.localeCompare(b);
      });

      return { xsdFiles };
    } finally {
      try {
        await rm(tempDir, { recursive: true });
      } catch {
        // Ignore cleanup errors.
      }
    }
  });
