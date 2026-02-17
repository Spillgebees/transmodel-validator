import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ConfigCard } from "~/components/ConfigCard";
import { FileDropZone } from "~/components/FileDropZone";
import { NETEX_RULE_NAMES, SCHEMA_VERSIONS } from "~/lib/constants";
import { getSessions, saveSession } from "~/lib/sessions";
import type {
  FileResult,
  SelectedFile,
  Session,
  ValidationConfig,
  XmlSnippet,
} from "~/lib/types";

export const Route = createFileRoute("/")({
  component: Home,
});

interface ProgressState {
  phase: "preparing" | "validating" | "done";
  current: number;
  total: number;
  currentFileName?: string;
  /** Sub-phase within a file's validation (from server SSE events). */
  subPhase?: "xsd" | "rules" | "cross-doc";
}

function Home() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [config, setConfig] = useState<ValidationConfig>({
    format: "auto",
    schemaId: "netex@1.2-nc",
    enabledRules: [...NETEX_RULE_NAMES],
  });

  // Defer localStorage read to client to avoid hydration mismatch.
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  useEffect(() => {
    setRecentSessions(getSessions().slice(0, 5));
  }, []);

  const handleValidate = async () => {
    if (files.length === 0) return;
    setIsValidating(true);
    setError(null);
    setProgress({ phase: "preparing", current: 0, total: files.length });

    try {
      // Build FormData with raw file objects — files are sent as binary,
      // avoiding the client-side text decode + JSON re-encode round-trip.
      const formData = new FormData();
      for (const f of files) {
        formData.append("files", f.file, f.name);
      }
      formData.append("schemaId", config.schemaId);
      formData.append("format", config.format);
      if (config.enabledRules.length > 0) {
        formData.append("rules", JSON.stringify(config.enabledRules));
      }
      if (config.customSchemaBase64) {
        formData.append("customSchemaBase64", config.customSchemaBase64);
      }
      if (config.customSchemaFileName) {
        formData.append("customSchemaFileName", config.customSchemaFileName);
      }
      if (config.customSchemaRootXsd) {
        formData.append("customSchemaRootXsd", config.customSchemaRootXsd);
      }

      // Single POST — server handles file preparation + validation, streams progress via SSE.
      const response = await fetch("/api/validate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Validation request failed: ${response.status}`);
      }

      // Read the SSE stream.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let totalDocs = files.length; // Updated by the "prepared" event.
      let doneResult: {
        result: {
          files: FileResult[];
          totalFiles: number;
          passedFiles: number;
          failedFiles: number;
          totalErrors: number;
          durationMs: number;
        };
        xmlSnippets: Record<string, XmlSnippet>;
        resolvedSchemaPath?: string;
      } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from the buffer.
        // Each event is: "event: <name>\ndata: <json>\n\n"
        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          let eventName = "message";
          let eventData = "";
          for (const line of raw.split("\n")) {
            if (line.startsWith("event: ")) {
              eventName = line.slice(7);
            } else if (line.startsWith("data: ")) {
              eventData = line.slice(6);
            }
          }

          if (!eventData) continue;

          try {
            const parsed = JSON.parse(eventData);

            if (eventName === "prepared") {
              // Server finished extracting archives — now we know the real document count.
              totalDocs = parsed.totalDocuments as number;
              setProgress({
                phase: "validating",
                current: 0,
                total: totalDocs,
              });
            } else if (eventName === "progress") {
              const phase = parsed.phase as string;
              const fileIndex = parsed.fileIndex as number | undefined;
              const fileName = parsed.fileName as string | undefined;

              if (phase === "file-done") {
                setProgress({
                  phase: "validating",
                  current: (fileIndex ?? 0) + 1,
                  total: totalDocs,
                  currentFileName: fileName,
                });
              } else if (phase === "cross-doc") {
                setProgress({
                  phase: "validating",
                  current: totalDocs,
                  total: totalDocs,
                  subPhase: "cross-doc",
                });
              } else if (phase === "complete") {
                setProgress({
                  phase: "done",
                  current: totalDocs,
                  total: totalDocs,
                });
              } else {
                setProgress({
                  phase: "validating",
                  current: fileIndex ?? 0,
                  total: totalDocs,
                  currentFileName: fileName,
                  subPhase: phase as "xsd" | "rules",
                });
              }
            } else if (eventName === "done") {
              doneResult = parsed;
            } else if (eventName === "error") {
              throw new Error(parsed.message ?? "Unknown server error");
            }
          } catch (parseErr) {
            // If it's a thrown Error from above, re-throw.
            if (
              parseErr instanceof Error &&
              parseErr.message !== "Unknown server error" &&
              eventName === "error"
            ) {
              throw parseErr;
            }
            // If it was a JSON parse error from a progress event, skip.
            if (eventName === "error") throw parseErr;
          }
        }
      }

      if (!doneResult) {
        throw new Error("Validation stream ended without a result.");
      }

      setProgress({ phase: "done", current: totalDocs, total: totalDocs });

      const session: Session = {
        id: crypto.randomUUID(),
        format: config.format,
        schemaId: config.schemaId,
        fileNames: files.map((f) => f.name),
        customSchemaFileName: config.customSchemaFileName,
        customSchemaRootXsd: config.customSchemaRootXsd,
        resolvedSchemaPath: doneResult.resolvedSchemaPath,
        result: doneResult.result,
        xmlSnippets: doneResult.xmlSnippets,
        createdAt: new Date().toISOString(),
      };

      saveSession(session);
      navigate({
        to: "/results/$sessionId",
        params: { sessionId: session.id },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Validation failed:", err);
      setError(message);
    } finally {
      setIsValidating(false);
      setProgress(null);
    }
  };

  // Custom schema is incomplete if it's a zip without a chosen root XSD.
  const isCustomSchemaIncomplete =
    config.schemaId === "custom" &&
    (!config.customSchemaBase64 ||
      (config.customSchemaFileName?.toLowerCase().endsWith(".zip") &&
        !config.customSchemaRootXsd));

  const canValidate =
    files.length > 0 && !isValidating && !isCustomSchemaIncomplete;

  const progressPct =
    progress && progress.total > 0
      ? Math.round(
          progress.phase === "preparing"
            ? 5
            : progress.phase === "done"
              ? 100
              : 5 + (progress.current / progress.total) * 95,
        )
      : 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row">
      {/* Left: Config card (sticky) */}
      <div className="hidden lg:block lg:w-[380px] lg:shrink-0">
        <div className="sticky top-8">
          <ConfigCard config={config} onChange={setConfig} />
        </div>
      </div>

      {/* Right: Files + actions */}
      <div className="flex flex-1 flex-col gap-6">
        {/* Mobile config (shown on small screens) */}
        <div className="lg:hidden">
          <ConfigCard config={config} onChange={setConfig} />
        </div>

        {/* Drop zone */}
        <FileDropZone
          onFilesAdded={(newFiles) =>
            setFiles((prev) => [...prev, ...newFiles])
          }
          disabled={isValidating}
        />

        {/* File list */}
        {files.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-text-muted">
              {files.length} file{files.length !== 1 ? "s" : ""} selected
            </span>
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-md bg-surface-overlay px-3 py-2"
              >
                <span className="truncate font-mono text-sm text-text">
                  {f.name}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setFiles((prev) => prev.filter((x) => x.id !== f.id))
                  }
                  className="ml-2 shrink-0 text-text-muted transition-colors hover:text-text"
                  aria-label={`Remove ${f.name}`}
                  disabled={isValidating}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M18 6 6 18M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            <p className="font-medium">Validation failed</p>
            <p className="mt-1 font-mono text-xs opacity-80">{error}</p>
          </div>
        )}

        {/* Progress bar */}
        {isValidating && progress && (
          <div className="space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-surface-overlay">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>
                {progress.phase === "preparing" ? (
                  "Extracting files..."
                ) : progress.phase === "done" ? (
                  "Done!"
                ) : progress.currentFileName ? (
                  <>
                    Validating{" "}
                    <span className="font-mono">
                      {progress.currentFileName}
                    </span>
                    {progress.subPhase === "xsd" && (
                      <span className="opacity-70"> — Schema</span>
                    )}
                    {progress.subPhase === "rules" && (
                      <span className="opacity-70"> — Business rules</span>
                    )}
                    {progress.subPhase === "cross-doc" && (
                      <span className="opacity-70">
                        {" "}
                        — Cross-document rules
                      </span>
                    )}
                  </>
                ) : (
                  "Validating..."
                )}
              </span>
              <span className="tabular-nums">
                {progress.phase === "preparing"
                  ? ""
                  : `${Math.min(progress.current + 1, progress.total)} / ${progress.total}`}
              </span>
            </div>
          </div>
        )}

        {/* Validate button */}
        <button
          type="button"
          onClick={handleValidate}
          disabled={!canValidate}
          className={`flex w-full items-center justify-center rounded-lg py-3 text-base font-semibold transition-colors ${
            !canValidate
              ? "cursor-not-allowed bg-surface-overlay text-text-muted"
              : "bg-primary text-white hover:bg-primary-hover"
          }`}
        >
          {isValidating
            ? "Validating..."
            : isCustomSchemaIncomplete
              ? "Select a schema to validate"
              : files.length === 0
                ? "Select files to validate"
                : `Validate ${files.length} file${files.length !== 1 ? "s" : ""}`}
        </button>

        {/* Recent sessions */}
        {recentSessions.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-text">Recent sessions</h3>
            <div className="flex flex-col gap-2">
              {recentSessions.map((s) => {
                const schemaLabel =
                  SCHEMA_VERSIONS.find((sv) => sv.id === s.schemaId)?.label ??
                  s.schemaId;
                const firstName = s.fileNames[0];
                const extraCount = s.fileNames.length - 1;
                const tooltip = s.fileNames.join("\n");
                const counts = sessionCheckCounts(s);

                return (
                  <div
                    key={s.id}
                    className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface-raised px-4 py-3"
                  >
                    {/* Left: file info + meta */}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span
                        className="flex min-w-0 items-center gap-1.5"
                        title={tooltip}
                      >
                        <span className="truncate rounded bg-surface-overlay px-2 py-1 font-mono text-xs text-text-secondary">
                          {firstName}
                        </span>
                        {extraCount > 0 && (
                          <span className="shrink-0 text-xs text-text-muted">
                            +{extraCount} more
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-text-muted">
                        {schemaLabel}
                        <span className="mx-1 text-text-dim">&middot;</span>
                        {relativeTime(s.createdAt)}
                      </span>
                    </div>

                    {/* Center: icon + count stacked vertically */}
                    <div className="flex shrink-0 flex-col gap-0.5 text-xs tabular-nums">
                      <span
                        className={`flex items-center gap-1.5 ${counts.passed > 0 ? "text-success" : "text-text-dim/30"}`}
                      >
                        <span className="inline-flex w-4 justify-center">
                          <CheckCircleIcon className="h-3.5 w-3.5" />
                        </span>
                        <span className="w-8 text-right">{counts.passed}</span>
                      </span>
                      <span
                        className={`flex items-center gap-1.5 ${counts.skipped > 0 ? "text-skipped" : "text-text-dim/30"}`}
                      >
                        <span className="inline-flex w-4 justify-center">
                          <SkipIcon className="h-3.5 w-3.5" />
                        </span>
                        <span className="w-8 text-right">{counts.skipped}</span>
                      </span>
                      <span
                        className={`flex items-center gap-1.5 ${counts.failed > 0 ? "text-error" : "text-text-dim/30"}`}
                      >
                        <span className="inline-flex w-4 justify-center">
                          <XCircleIcon className="h-3.5 w-3.5" />
                        </span>
                        <span className="w-8 text-right">{counts.failed}</span>
                      </span>
                    </div>

                    {/* Right: detail button */}
                    <button
                      type="button"
                      onClick={() =>
                        navigate({
                          to: "/results/$sessionId",
                          params: { sessionId: s.id },
                        })
                      }
                      className="shrink-0 rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
                      aria-label={`View session details for ${firstName}`}
                    >
                      {/* ChevronRight icon */}
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m9 18 6-6-6-6"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Icons (same as results page) ──────────────────────────────────── */

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 ${className ?? ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 ${className ?? ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function SkipIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 ${className ?? ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M8 12h8" />
    </svg>
  );
}

/** Compute aggregate check counts (failed/skipped/passed) for a session. */
function sessionCheckCounts(s: Session): {
  failed: number;
  skipped: number;
  passed: number;
} {
  let failed = 0;
  let skipped = 0;
  let passed = 0;

  for (const file of s.result.files) {
    // Group errors by rule (same logic as results page).
    const groups = new Map<string, { hasReal: boolean; allInfo: boolean }>();
    for (const err of file.errors) {
      const key = err.rule ?? err.source;
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, {
          hasReal: err.severity !== "info",
          allInfo: err.severity === "info",
        });
      } else {
        if (err.severity !== "info") existing.hasReal = true;
        if (err.severity !== "info") existing.allInfo = false;
      }
    }

    for (const g of groups.values()) {
      if (g.hasReal) failed++;
      else if (g.allInfo) skipped++;
    }

    // Passed = rules that ran but produced no errors at all.
    const rulesWithErrors = new Set(
      [...file.errors].map((e) => e.rule ?? e.source),
    );
    for (const name of file.rulesRun ?? []) {
      if (!rulesWithErrors.has(name)) passed++;
    }
  }

  return { failed, skipped, passed };
}

/** Format an ISO date string as a relative time label. */
function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  // Beyond a week, show short date.
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
