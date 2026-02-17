import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { InlineMarkdown } from "~/components/InlineMarkdown";
import { XmlViewer } from "~/components/XmlViewer";
import { NETEX_RULES, SCHEMA_VERSIONS, SIRI_RULES } from "~/lib/constants";
import { getSession } from "~/lib/sessions";
import type { Session, ValidationError, XmlSnippet } from "~/lib/types";

export const Route = createFileRoute("/results/$sessionId")({
  component: Results,
});

function Results() {
  const { sessionId } = Route.useParams();
  const session = getSession(sessionId);

  if (!session) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h1 className="mb-4 text-xl font-semibold">Session not found</h1>
        <p className="text-text-muted">This session may have been cleared.</p>
        <Link to="/" className="mt-4 inline-block text-primary hover:underline">
          Start new session
        </Link>
      </div>
    );
  }

  const { result, schemaId, fileNames, xmlSnippets } = session;

  const checkCounts = result.files.reduce(
    (acc, f) => {
      const groups = groupErrorsByRule(f.errors);
      const rulesWithErrors = new Set(groups.map((g) => g.name));
      acc.failed += groups.filter(isGroupFailed).length;
      acc.skipped += groups.filter(isGroupSkipped).length;
      acc.passed += (f.rulesRun ?? []).filter(
        (n) => !rulesWithErrors.has(n),
      ).length;
      return acc;
    },
    { failed: 0, skipped: 0, passed: 0 },
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Bento cards */}
      <div className="mb-6 grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
        <SessionCard
          schemaId={schemaId}
          fileNames={fileNames}
          session={session}
        />
        <ResultsSummaryCard
          totalErrors={result.totalErrors}
          totalFiles={result.totalFiles}
          durationMs={result.durationMs}
          passedCheckCount={checkCounts.passed}
          failedCheckCount={checkCounts.failed}
          skippedCheckCount={checkCounts.skipped}
        />
        <ExportCard session={session} />
      </div>

      {/* File results */}
      <div className="space-y-4">
        {result.files.map((file, idx) => (
          <FileSection
            key={idx}
            file={file}
            snippet={xmlSnippets?.[file.fileName]}
          />
        ))}
      </div>
    </div>
  );
}

function SessionCard({
  schemaId,
  fileNames,
  session,
}: {
  schemaId: string;
  fileNames: string[];
  session: Session;
}) {
  const schemaLabel =
    SCHEMA_VERSIONS.find((sv) => sv.id === schemaId)?.label ?? schemaId;

  const isCustomSchema = schemaId === "custom";
  const validatedFileCount = session.result.totalFiles;
  const uploadedFileCount = fileNames.length;

  return (
    <section
      className="flex h-full flex-col gap-4 rounded-lg border border-border bg-surface-raised p-5"
      aria-label="Session information"
    >
      <div className="flex h-7 items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Session
        </h2>
        <Link
          to="/"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          New session
        </Link>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-3">
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="shrink-0 text-text-muted">Schema</dt>
            <dd
              className="min-w-0 truncate font-mono text-text"
              title={schemaLabel}
            >
              {schemaLabel}
            </dd>
          </div>
          {isCustomSchema && session.customSchemaFileName && (
            <div className="flex items-center justify-between gap-4">
              <dt className="shrink-0 text-text-muted">Schema</dt>
              <dd
                className="truncate rounded bg-surface-overlay px-2 py-1 font-mono text-xs text-text-secondary"
                title={session.customSchemaFileName}
              >
                {session.customSchemaFileName}
              </dd>
            </div>
          )}
          {isCustomSchema && session.customSchemaRootXsd && (
            <div className="flex items-center justify-between gap-4">
              <dt className="shrink-0 text-text-muted">Root XSD</dt>
              <dd
                className="truncate rounded bg-surface-overlay px-2 py-1 font-mono text-xs text-text-secondary"
                title={session.customSchemaRootXsd}
              >
                {session.customSchemaRootXsd}
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <dt className="shrink-0 text-text-muted">Input</dt>
            <dd className="min-w-0 truncate font-mono text-text">
              {uploadedFileCount} file{uploadedFileCount !== 1 ? "s" : ""}
              {validatedFileCount !== uploadedFileCount && (
                <span className="text-text-muted">
                  {" "}
                  ({validatedFileCount} XML file
                  {validatedFileCount !== 1 ? "s" : ""} extracted)
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function ResultsSummaryCard({
  totalErrors,
  totalFiles,
  durationMs,
  passedCheckCount,
  failedCheckCount,
  skippedCheckCount,
}: {
  totalErrors: number;
  totalFiles: number;
  durationMs: number;
  passedCheckCount: number;
  failedCheckCount: number;
  skippedCheckCount: number;
}) {
  const durationStr =
    durationMs >= 1000
      ? `${(durationMs / 1000).toFixed(1)}s`
      : `${durationMs}ms`;

  const allClear = totalErrors === 0;
  const total = passedCheckCount + skippedCheckCount + failedCheckCount;
  const pctPass = total > 0 ? (passedCheckCount / total) * 100 : 0;
  const pctSkip = total > 0 ? (skippedCheckCount / total) * 100 : 0;
  const pctFail = total > 0 ? (failedCheckCount / total) * 100 : 0;

  return (
    <section
      className="flex h-full flex-col gap-4 rounded-lg border border-border bg-surface-raised p-5"
      aria-label="Validation results"
    >
      <div className="flex h-7 items-center">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Results
        </h2>
      </div>

      {/* Key-value summary */}
      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-text-muted">Status</dt>
          <dd
            className={`font-semibold ${allClear ? "text-success" : "text-error"}`}
          >
            {allClear ? "Passed" : "Failed"}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-text-muted">Files</dt>
          <dd className="font-mono font-semibold text-text">{totalFiles}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-text-muted">Duration</dt>
          <dd className="font-mono font-semibold text-text">{durationStr}</dd>
        </div>
      </dl>

      {/* Checks: progress bar + legend */}
      <div className="mt-auto flex flex-col gap-2">
        <span className="text-xs text-text-muted">Checks</span>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full">
          {pctPass > 0 && (
            <div className="bg-success" style={{ width: `${pctPass}%` }} />
          )}
          {pctSkip > 0 && (
            <div className="bg-skipped" style={{ width: `${pctSkip}%` }} />
          )}
          {pctFail > 0 && (
            <div className="bg-error" style={{ width: `${pctFail}%` }} />
          )}
        </div>
        <div className="flex justify-between text-xs tabular-nums">
          <span
            className={`flex items-center gap-1 ${passedCheckCount > 0 ? "text-success" : "text-text-dim/30"}`}
          >
            <CheckCircleIcon className="h-3 w-3" /> {passedCheckCount}
          </span>
          <span
            className={`flex items-center gap-1 ${skippedCheckCount > 0 ? "text-skipped" : "text-text-dim/30"}`}
          >
            <SkipIcon className="h-3 w-3" /> {skippedCheckCount}
          </span>
          <span
            className={`flex items-center gap-1 ${failedCheckCount > 0 ? "text-error" : "text-text-dim/30"}`}
          >
            <XCircleIcon className="h-3 w-3" /> {failedCheckCount}
          </span>
        </div>
      </div>
    </section>
  );
}

function ExportCard({ session }: { session: Session }) {
  const download = (format: "json" | "csv" | "xml") => {
    let content: string;
    let mime: string;
    let ext: string;

    if (format === "json") {
      const { xmlSnippets: _, ...exportSession } = session;
      content = JSON.stringify(exportSession.result, null, 2);
      mime = "application/json";
      ext = "json";
    } else if (format === "csv") {
      const rows = ["file,format,rule,severity,category,line,message"];
      for (const f of session.result.files) {
        for (const e of f.errors) {
          rows.push(
            [
              f.fileName,
              f.format,
              e.rule ?? e.source,
              e.severity,
              e.category,
              e.line?.toString() ?? "",
              `"${e.message.replace(/"/g, '""')}"`,
            ].join(","),
          );
        }
      }
      content = rows.join("\n");
      mime = "text/csv";
      ext = "csv";
    } else {
      const lines = ['<?xml version="1.0" encoding="UTF-8"?>'];
      lines.push(
        `<ValidationReport totalErrors="${session.result.totalErrors}">`,
      );
      for (const f of session.result.files) {
        lines.push(`  <File name="${esc(f.fileName)}" passed="${f.passed}">`);
        for (const e of f.errors) {
          lines.push(
            `    <Error rule="${esc(e.rule ?? e.source)}" line="${e.line ?? ""}">${esc(e.message)}</Error>`,
          );
        }
        lines.push("  </File>");
      }
      lines.push("</ValidationReport>");
      content = lines.join("\n");
      mime = "application/xml";
      ext = "xml";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `validation-report.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      className="flex h-full flex-col gap-4 rounded-lg border border-border bg-surface-raised p-5"
      aria-label="Export options"
    >
      <div className="flex h-7 items-center">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Export
        </h2>
      </div>
      <div className="mt-auto flex flex-col gap-3">
        <span className="text-xs text-text-muted">Reports</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => download("json")}
            className="flex items-center justify-center gap-2 rounded-md border border-border bg-surface-overlay px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
          >
            <DownloadIcon />
            JSON
          </button>
          <button
            type="button"
            onClick={() => download("xml")}
            className="flex items-center justify-center gap-2 rounded-md border border-border bg-surface-overlay px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
          >
            <DownloadIcon />
            XML
          </button>
        </div>
        <span className="text-xs text-text-muted">Spreadsheet</span>
        <button
          type="button"
          onClick={() => download("csv")}
          className="flex items-center justify-center gap-2 rounded-md border border-border bg-surface-overlay px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
        >
          <DownloadIcon />
          CSV
        </button>
      </div>
    </section>
  );
}

interface FileSectionProps {
  file: {
    fileName: string;
    format: string;
    errors: ValidationError[];
    passed: boolean;
    rulesRun?: string[];
    ruleTiming?: Record<string, number>;
  };
  snippet?: XmlSnippet;
}

function isGroupFailed(g: RuleGroup): boolean {
  return g.errors.some((e) => e.severity !== "info");
}

function isGroupSkipped(g: RuleGroup): boolean {
  return g.errors.length > 0 && g.errors.every((e) => e.severity === "info");
}

function FileSection({ file, snippet }: FileSectionProps) {
  const [open, setOpen] = useState(true);

  const ruleGroups = groupErrorsByRule(file.errors);
  const schemaGroup = ruleGroups.find((g) => g.name === "xsd");
  const ruleOnlyGroups = ruleGroups.filter((g) => g.name !== "xsd");
  const failedRules = ruleOnlyGroups.filter(isGroupFailed);
  const skippedRules = ruleOnlyGroups.filter(isGroupSkipped);
  const rulesWithErrors = new Set(ruleGroups.map((g) => g.name));
  const schemaRan = (file.rulesRun ?? []).includes("xsd");
  const passedRuleNames = (file.rulesRun ?? []).filter(
    (name) => name !== "xsd" && !rulesWithErrors.has(name),
  );
  const showSchema = !!(schemaGroup || schemaRan);
  const hasRules =
    failedRules.length > 0 ||
    skippedRules.length > 0 ||
    passedRuleNames.length > 0;

  const totalChecks =
    (showSchema ? 1 : 0) +
    failedRules.length +
    skippedRules.length +
    passedRuleNames.length;

  return (
    <section
      className="rounded-lg border border-border bg-surface-raised"
      aria-label={`Validation result for ${file.fileName}`}
    >
      {/* File header */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-surface-overlay/50"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <svg
            className={`h-4 w-4 text-text-muted transition-transform ${!open ? "-rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
          <span className="font-mono text-sm font-medium text-text">
            {file.fileName}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {file.passed ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-success/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-success">
              <CheckCircleIcon className="h-3 w-3" />
              Pass
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-error/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-error">
              <XCircleIcon className="h-3 w-3" />
              Fail
            </span>
          )}
        </div>
      </button>

      {/* File body */}
      {open && (
        <div className="border-t border-border">
          {/* Schema section — blue left accent */}
          {showSchema && (
            <div className="my-3 ml-3 border-l-[3px] border-l-primary/50">
              <SchemaCheckContent
                schemaGroup={schemaGroup}
                snippet={snippet}
                durationMs={file.ruleTiming?.xsd}
              />
            </div>
          )}

          {/* Rules section — muted left accent */}
          {hasRules && (
            <div className="my-3 ml-3 border-l-[3px] border-l-text-muted/30">
              {failedRules.map((group) => (
                <FailedRuleSection
                  key={group.name}
                  group={group}
                  snippet={snippet}
                  durationMs={file.ruleTiming?.[group.name]}
                />
              ))}
              {/* biome-ignore lint/a11y/useSemanticElements: custom styled list without default list styling */}
              <div
                className="flex flex-col"
                role="list"
                aria-label="Rule checks"
              >
                {skippedRules.map((group) => (
                  <SkippedCheckRow
                    key={group.name}
                    group={group}
                    durationMs={file.ruleTiming?.[group.name]}
                  />
                ))}
                {passedRuleNames.map((name) => (
                  <PassedCheckRow
                    key={name}
                    name={name}
                    durationMs={file.ruleTiming?.[name]}
                  />
                ))}
              </div>
            </div>
          )}

          {totalChecks === 0 && file.errors.length === 0 && (
            <div className="px-4 py-3">
              <p className="text-sm text-success">All checks passed.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SchemaCheckContent({
  schemaGroup,
  snippet,
  durationMs,
}: {
  schemaGroup?: RuleGroup;
  snippet?: XmlSnippet;
  durationMs?: number;
}) {
  if (schemaGroup && isGroupFailed(schemaGroup)) {
    const realErrors = schemaGroup.errors.filter((e) => e.severity !== "info");
    return (
      <>
        <div className="flex w-full items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <XCircleIcon className="h-4 w-4 shrink-0 text-error" />
            <span className="font-mono text-sm text-text">Schema</span>
          </div>
          <div className="flex shrink-0 items-center">
            <span className="w-16 text-right font-mono text-xs text-text-muted">
              {durationMs != null ? formatDuration(durationMs) : ""}
            </span>
            <span className="w-20 text-right text-xs font-medium text-error">
              {realErrors.length} error{realErrors.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        {realErrors.length > 0 && (
          <div className="px-4 pb-4">
            <ErrorCard errors={realErrors} snippet={snippet} />
          </div>
        )}
      </>
    );
  }

  if (schemaGroup && isGroupSkipped(schemaGroup)) {
    return <SkippedCheckRow group={schemaGroup} durationMs={durationMs} />;
  }

  return <PassedCheckRow name="xsd" durationMs={durationMs} />;
}

interface RuleGroup {
  name: string;
  errors: ValidationError[];
}

function groupErrorsByRule(errors: ValidationError[]): RuleGroup[] {
  const map = new Map<string, ValidationError[]>();
  for (const err of errors) {
    const key = err.rule ?? err.source;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(err);
  }
  return [...map.entries()]
    .map(([name, errs]) => ({ name, errors: errs }))
    .sort((a, b) => {
      const aFailed = a.errors.some((e) => e.severity !== "info");
      const bFailed = b.errors.some((e) => e.severity !== "info");
      const aSkipped =
        a.errors.length > 0 && a.errors.every((e) => e.severity === "info");
      const bSkipped =
        b.errors.length > 0 && b.errors.every((e) => e.severity === "info");
      if (aFailed && !bFailed) return -1;
      if (!aFailed && bFailed) return 1;
      if (aSkipped && !bSkipped) return -1;
      if (!aSkipped && bSkipped) return 1;
      return 0;
    });
}

function FailedRuleSection({
  group,
  snippet,
  durationMs,
}: {
  group: RuleGroup;
  snippet?: XmlSnippet;
  durationMs?: number;
}) {
  const realErrors = group.errors.filter((e) => e.severity !== "info");

  const description = checkDescription(group.name);

  return (
    <div className="border-b border-border/50">
      {/* Rule header row */}
      <div className="flex w-full items-start justify-between px-4 py-3">
        <div className="flex min-w-0 items-start gap-2">
          <XCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-error" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm text-text">
              <InlineMarkdown text={checkDisplayName(group.name)} />
            </span>
            {description && (
              <span className="text-xs leading-relaxed text-text-muted">
                <InlineMarkdown text={description} />
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center">
          <span className="w-16 text-right font-mono text-xs text-text-muted">
            {durationMs != null ? formatDuration(durationMs) : ""}
          </span>
          <span className="w-20 text-right text-xs font-medium text-error">
            {realErrors.length} error{realErrors.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Error detail + code viewer — always shown */}
      {realErrors.length > 0 && (
        <div className="px-4 pb-4">
          <ErrorCard errors={realErrors} snippet={snippet} />
        </div>
      )}
    </div>
  );
}

function SkippedCheckRow({
  group,
  durationMs,
}: {
  group: RuleGroup;
  durationMs?: number;
}) {
  const reason = group.errors[0]?.message ?? "Prerequisite not met";
  const description = checkDescription(group.name);

  return (
    // biome-ignore lint/a11y/useSemanticElements: custom styled list item without default list styling
    <div
      className="flex items-start justify-between border-b border-border/50 px-4 py-3 last:border-b-0"
      role="listitem"
    >
      <div className="flex min-w-0 items-start gap-2">
        <SkipIcon className="mt-0.5 h-4 w-4 shrink-0 text-skipped" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm text-text">
            <InlineMarkdown text={checkDisplayName(group.name)} />
          </span>
          {description && (
            <span className="text-xs leading-relaxed text-text-muted">
              <InlineMarkdown text={description} />
            </span>
          )}
          <span className="text-xs italic text-text-muted">
            <InlineMarkdown text={reason} />
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center">
        <span className="w-16 text-right font-mono text-xs text-text-muted">
          {durationMs != null ? formatDuration(durationMs) : ""}
        </span>
        <span className="w-20 text-right text-xs font-medium text-skipped">
          skipped
        </span>
      </div>
    </div>
  );
}

function PassedCheckRow({
  name,
  durationMs,
}: {
  name: string;
  durationMs?: number;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: custom styled list item without default list styling
    <div
      className="flex items-start justify-between border-b border-border/50 px-4 py-3 last:border-b-0"
      role="listitem"
    >
      <div className="flex min-w-0 items-start gap-2">
        <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <span className="text-sm text-text">
          <InlineMarkdown text={checkDisplayName(name)} />
        </span>
      </div>
      <div className="flex shrink-0 items-center">
        <span className="w-16 text-right font-mono text-xs text-text-muted">
          {durationMs != null ? formatDuration(durationMs) : ""}
        </span>
        <span className="w-20 text-right text-xs font-medium text-success">
          pass
        </span>
      </div>
    </div>
  );
}

/** Map internal check names to human-readable labels. */
function checkDisplayName(name: string): string {
  if (name === "xsd") return "Schema";
  const rule =
    NETEX_RULES.find((r) => r.name === name) ??
    SIRI_RULES.find((r) => r.name === name);
  return rule?.displayName ?? name;
}

/** Look up the full description for a rule (returns undefined for unknown/xsd). */
function checkDescription(name: string): string | undefined {
  if (name === "xsd") return undefined;
  const rule =
    NETEX_RULES.find((r) => r.name === name) ??
    SIRI_RULES.find((r) => r.name === name);
  return rule?.description;
}

function ErrorCard({
  errors,
  snippet,
}: {
  errors: ValidationError[];
  snippet?: XmlSnippet;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const err = errors[currentIdx];
  const total = errors.length;
  const hasCode = snippet && err.line;

  return (
    <div
      className={`overflow-hidden rounded-lg border border-border ${hasCode ? "" : "bg-surface-overlay/50"}`}
    >
      {/* Message + pagination header */}
      <div
        className={`flex items-center gap-4 px-4 py-3 ${hasCode ? "bg-surface-overlay/50" : ""}`}
      >
        <p className="min-w-0 flex-1 text-sm text-text">
          <InlineMarkdown text={err.message} />
        </p>
        <div className="flex shrink-0 items-center gap-1.5 text-xs text-text-muted">
          <span className="tabular-nums">
            {currentIdx + 1}/{total}
          </span>
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
                className="rounded p-0.5 transition-colors hover:bg-surface-overlay hover:text-text disabled:opacity-30"
                aria-label="Previous error"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))}
                disabled={currentIdx === total - 1}
                className="rounded p-0.5 transition-colors hover:bg-surface-overlay hover:text-text disabled:opacity-30"
                aria-label="Next error"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Code viewer — seamlessly attached below the message */}
      {hasCode && (
        <XmlViewer
          snippet={snippet}
          errorLines={[err.line]}
          focusLine={err.line}
          borderless
        />
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms >= 1) return `${ms}ms`;
  return "<1ms";
}

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

function DownloadIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
