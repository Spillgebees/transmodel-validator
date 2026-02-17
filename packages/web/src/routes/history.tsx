import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SCHEMA_VERSIONS } from "~/lib/constants";
import { clearSessions, getSessions } from "~/lib/sessions";
import type { Session } from "~/lib/types";

export const Route = createFileRoute("/history")({
  component: History,
});

type Filter = "all" | "passed" | "failed";

function History() {
  const navigate = useNavigate();
  const [sessions, setSessionsState] = useState(getSessions);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const filtered = sessions.filter((s) => {
    if (filter === "passed" && s.result.failedFiles > 0) return false;
    if (filter === "failed" && s.result.failedFiles === 0) return false;
    if (search) {
      const q = search.toLowerCase();
      const schemaLabel =
        SCHEMA_VERSIONS.find((sv) => sv.id === s.schemaId)?.label ?? s.schemaId;
      return (
        schemaLabel.toLowerCase().includes(q) ||
        s.fileNames.some((f) => f.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleClear = () => {
    clearSessions();
    setSessionsState([]);
  };

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "passed", label: "Passed" },
    { value: "failed", label: "Failed" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-6">
        {/* Header row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-text">Session History</h1>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              New session
            </Link>
            {sessions.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface-overlay px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="search"
              placeholder="Search sessions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-overlay py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-overlay p-1">
            {filters.map((f) => (
              <button
                type="button"
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  filter === f.value
                    ? "bg-primary text-white"
                    : "text-text-secondary hover:text-text"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-text-muted">
            {sessions.length === 0 ? (
              <p>No sessions yet. Start validating to see history.</p>
            ) : (
              <p>No sessions match your filters.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-overlay/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Files
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Schema
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Checks
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const firstName = s.fileNames[0];
                  const extraCount = s.fileNames.length - 1;
                  const tooltip = s.fileNames.join("\n");
                  const counts = sessionCheckCounts(s);

                  return (
                    <tr
                      key={s.id}
                      onClick={() =>
                        navigate({
                          to: "/results/$sessionId",
                          params: { sessionId: s.id },
                        })
                      }
                      className="cursor-pointer border-b border-border/50 transition-colors last:border-b-0 hover:bg-surface-overlay/50"
                    >
                      <td className="px-4 py-3.5">
                        <span
                          className="flex items-center gap-1.5"
                          title={tooltip}
                        >
                          <span className="truncate rounded bg-surface-overlay px-2 py-1 font-mono text-xs text-text-secondary">
                            {firstName}
                          </span>
                          {extraCount > 0 && (
                            <span className="shrink-0 text-xs text-text-muted">
                              +{extraCount}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-text-secondary">
                        {SCHEMA_VERSIONS.find((sv) => sv.id === s.schemaId)
                          ?.label ?? s.schemaId}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3 text-xs tabular-nums">
                          <span
                            className={`inline-flex items-center gap-1.5 ${counts.passed > 0 ? "text-success" : "text-text-dim/30"}`}
                          >
                            <span className="inline-flex w-4 justify-center">
                              <CheckCircleIcon className="h-3.5 w-3.5" />
                            </span>
                            <span className="w-8 text-right">
                              {counts.passed}
                            </span>
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 ${counts.skipped > 0 ? "text-skipped" : "text-text-dim/30"}`}
                          >
                            <span className="inline-flex w-4 justify-center">
                              <SkipIcon className="h-3.5 w-3.5" />
                            </span>
                            <span className="w-8 text-right">
                              {counts.skipped}
                            </span>
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 ${counts.failed > 0 ? "text-error" : "text-text-dim/30"}`}
                          >
                            <span className="inline-flex w-4 justify-center">
                              <XCircleIcon className="h-3.5 w-3.5" />
                            </span>
                            <span className="w-8 text-right">
                              {counts.failed}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-text-secondary">
                        {s.result.durationMs >= 1000
                          ? `${(s.result.durationMs / 1000).toFixed(1)}s`
                          : `${s.result.durationMs}ms`}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-text-muted">
                        {relativeTime(s.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Icons ──────────────────────────────────────────────────────────── */

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

/* ── Helpers ─────────────────────────────────────────────────────────── */

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
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
