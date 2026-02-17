/**
 * Configuration card for validation settings.
 *
 * Allows the user to select a format, schema version, and toggle
 * individual validation rules. Supports custom XSD uploads (single
 * files or zip archives with a searchable root picker).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { InlineMarkdown } from "~/components/InlineMarkdown";
import type { RuleDescriptor, SchemaVersionDescriptor } from "~/lib/constants";
import {
  NETEX_RULE_DESCRIPTORS,
  NETEX_RULE_NAMES,
  SCHEMA_VERSIONS,
  SIRI_RULE_DESCRIPTORS,
  SIRI_RULE_NAMES,
} from "~/lib/constants";
import type { ValidationConfig } from "~/lib/types";
import { listSchemaXsdFiles } from "~/lib/validation.functions";

interface ConfigCardProps {
  config: ValidationConfig;
  onChange: (config: ValidationConfig) => void;
}

const FORMAT_OPTIONS = [
  { value: "auto", label: "Auto-detect" },
  { value: "netex", label: "NeTEx" },
  { value: "siri", label: "SIRI" },
] as const;

/** Returns schema version options applicable to the selected format. */
function getSchemasForFormat(format: string) {
  if (format === "siri")
    return SCHEMA_VERSIONS.filter((s) => s.format === "siri");
  if (format === "netex")
    return SCHEMA_VERSIONS.filter((s) => s.format === "netex");
  return [...SCHEMA_VERSIONS]; // auto shows all schemas
}

/** Returns rule metadata applicable to the selected format. */
function getRulesForFormat(format: string): readonly RuleDescriptor[] {
  if (format === "siri") return SIRI_RULE_DESCRIPTORS;
  return NETEX_RULE_DESCRIPTORS; // auto defaults to NeTEx rules
}

/** Returns rule name strings applicable to the selected format. */
function getRuleNamesForFormat(format: string): string[] {
  if (format === "siri") return [...SIRI_RULE_NAMES];
  return [...NETEX_RULE_NAMES]; // auto defaults to NeTEx rules
}

/** Converts an ArrayBuffer to a base64 string. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function ConfigCard({ config, onChange }: ConfigCardProps) {
  const rules = getRulesForFormat(config.format);
  const schemaInputRef = useRef<HTMLInputElement>(null);
  const [isLoadingXsdList, setIsLoadingXsdList] = useState(false);
  const [xsdListError, setXsdListError] = useState<string | null>(null);
  const [ruleFilter, setRuleFilter] = useState("");

  const handleSchemaFile = useCallback(
    async (file: File) => {
      const buffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);

      const isZip = file.name.toLowerCase().endsWith(".zip");

      if (isZip) {
        // Upload to server, list .xsd files, let user pick root.
        setIsLoadingXsdList(true);
        setXsdListError(null);
        try {
          const result = (await listSchemaXsdFiles({
            data: { base64, fileName: file.name },
          })) as { xsdFiles: string[] };

          if (result.xsdFiles.length === 0) {
            setXsdListError("No .xsd files found in the archive.");
            onChange({
              ...config,
              customSchemaBase64: undefined,
              customSchemaFileName: undefined,
              customSchemaRootXsd: undefined,
              customSchemaXsdFiles: undefined,
            });
          } else if (result.xsdFiles.length === 1) {
            // Only one XSD — auto-select it.
            onChange({
              ...config,
              customSchemaBase64: base64,
              customSchemaFileName: file.name,
              customSchemaXsdFiles: result.xsdFiles,
              customSchemaRootXsd: result.xsdFiles[0],
            });
          } else {
            // Multiple XSDs — show picker, no auto-select.
            onChange({
              ...config,
              customSchemaBase64: base64,
              customSchemaFileName: file.name,
              customSchemaXsdFiles: result.xsdFiles,
              customSchemaRootXsd: undefined,
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setXsdListError(`Failed to read archive: ${msg}`);
        } finally {
          setIsLoadingXsdList(false);
        }
      } else {
        // Single .xsd file — no picker needed.
        onChange({
          ...config,
          customSchemaBase64: base64,
          customSchemaFileName: file.name,
          customSchemaXsdFiles: undefined,
          customSchemaRootXsd: undefined,
        });
      }
    },
    [config, onChange],
  );

  const isCustomSchema = config.schemaId === "custom";
  const isZipUploaded =
    isCustomSchema &&
    config.customSchemaFileName?.toLowerCase().endsWith(".zip");
  const hasMultipleXsds =
    isZipUploaded &&
    config.customSchemaXsdFiles &&
    config.customSchemaXsdFiles.length > 1;

  const enabledCount = config.enabledRules.length;

  const schemas = getSchemasForFormat(config.format);

  // Filter rules by search query (matches name, displayName, or description).
  const lowerFilter = ruleFilter.toLowerCase();
  const filteredRules = ruleFilter
    ? rules.filter(
        (r) =>
          r.name.toLowerCase().includes(lowerFilter) ||
          r.displayName.toLowerCase().includes(lowerFilter) ||
          r.description.toLowerCase().includes(lowerFilter),
      )
    : rules;

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-5">
      <div className="flex flex-col gap-6">
        {/* Format selector */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            {/* ToggleLeft icon */}
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <rect x="1" y="5" width="22" height="14" rx="7" ry="7" />
              <circle cx="8" cy="12" r="3" />
            </svg>
            <span>Format</span>
          </div>
          <div
            className="flex gap-2"
            role="radiogroup"
            aria-label="Validation format"
          >
            {FORMAT_OPTIONS.map((opt) => (
              // biome-ignore lint/a11y/useSemanticElements: custom radio button implementation using styled buttons
              <button
                type="button"
                key={opt.value}
                onClick={() =>
                  onChange({
                    ...config,
                    format: opt.value,
                    schemaId:
                      opt.value === "siri" ? "siri@2.2" : "netex@1.2-nc",
                    enabledRules: getRuleNamesForFormat(opt.value),
                    customSchemaBase64: undefined,
                    customSchemaFileName: undefined,
                    customSchemaRootXsd: undefined,
                    customSchemaXsdFiles: undefined,
                  })
                }
                className={`grow whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  config.format === opt.value
                    ? "bg-primary text-white"
                    : "bg-surface-overlay text-text-secondary hover:bg-surface-hover"
                }`}
                role="radio"
                aria-checked={config.format === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Schema version selector */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            {/* Layers icon */}
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"
              />
            </svg>
            <span>Schema version</span>
          </div>
          <SchemaVersionPicker
            schemas={schemas}
            value={config.schemaId}
            onChange={(schemaId) =>
              onChange({
                ...config,
                schemaId,
                customSchemaBase64:
                  schemaId !== "custom" ? undefined : config.customSchemaBase64,
                customSchemaFileName:
                  schemaId !== "custom"
                    ? undefined
                    : config.customSchemaFileName,
                customSchemaRootXsd:
                  schemaId !== "custom"
                    ? undefined
                    : config.customSchemaRootXsd,
                customSchemaXsdFiles:
                  schemaId !== "custom"
                    ? undefined
                    : config.customSchemaXsdFiles,
              })
            }
          />
        </div>

        {/* Custom schema panel */}
        {isCustomSchema && (
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-overlay/50 p-4">
            {/* File picker */}
            <div className="flex flex-col gap-2">
              <label
                className="text-xs font-medium text-text-muted"
                htmlFor="custom-schema-input"
              >
                XSD Schema
              </label>
              <button
                type="button"
                onClick={() => schemaInputRef.current?.click()}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left transition-colors ${
                  config.customSchemaFileName
                    ? "bg-surface-raised"
                    : "bg-surface-raised hover:bg-surface-hover"
                }`}
              >
                {/* FileText icon (Lucide outline) */}
                <svg
                  className={`h-4 w-4 shrink-0 ${config.customSchemaFileName ? "text-primary" : "text-text-muted"}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                  <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                  <path d="M10 9H8" />
                  <path d="M16 13H8" />
                  <path d="M16 17H8" />
                </svg>
                <span className="truncate font-mono text-sm text-text">
                  {config.customSchemaFileName ?? "Select schema file..."}
                </span>
              </button>
              <input
                id="custom-schema-input"
                ref={schemaInputRef}
                type="file"
                accept=".xsd,.zip"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleSchemaFile(e.target.files[0]);
                  }
                  e.target.value = "";
                }}
              />
              <p className="text-xs leading-relaxed text-text-muted">
                Upload an .xsd file or a .zip containing XSD files
              </p>
            </div>

            {/* Loading state while listing XSD files */}
            {isLoadingXsdList && (
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <svg
                  className="h-3.5 w-3.5 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Scanning archive for XSD files...
              </div>
            )}

            {/* Error from listing */}
            {xsdListError && (
              <p className="text-[11px] text-error">{xsdListError}</p>
            )}

            {/* Root XSD picker (only for zip archives with multiple XSDs) */}
            {hasMultipleXsds && (
              <SearchableXsdPicker
                files={config.customSchemaXsdFiles!}
                value={config.customSchemaRootXsd}
                onSelect={(xsd) =>
                  onChange({
                    ...config,
                    customSchemaRootXsd: xsd || undefined,
                  })
                }
              />
            )}

            {/* Confirmation when a single XSD was auto-selected */}
            {isZipUploaded &&
              config.customSchemaXsdFiles?.length === 1 &&
              config.customSchemaRootXsd && (
                <p className="text-[11px] text-text-muted">
                  Root XSD:{" "}
                  <span className="font-mono text-primary">
                    {config.customSchemaRootXsd}
                  </span>
                </p>
              )}
          </div>
        )}

        {/* Rules section */}
        {rules.length > 0 && (
          <div className="flex flex-col gap-3">
            {/* Header row */}
            <div className="flex items-center gap-2 text-sm text-text-muted">
              {/* Settings2 icon */}
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 7h-9"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14 17H5"
                />
                <circle cx="17" cy="17" r="3" />
                <circle cx="7" cy="7" r="3" />
              </svg>
              <span>Rules</span>
              <span className="ml-auto text-xs text-text-muted">
                {enabledCount}/{rules.length} active
              </span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...config,
                    enabledRules: getRuleNamesForFormat(config.format),
                  })
                }
                className="rounded px-1.5 py-0.5 text-xs text-text-muted transition-colors hover:bg-surface-overlay hover:text-text"
              >
                All
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...config, enabledRules: [] })}
                className="rounded px-1.5 py-0.5 text-xs text-text-muted transition-colors hover:bg-surface-overlay hover:text-text"
              >
                None
              </button>
            </div>

            {/* Filterable rule list */}
            <div className="rounded-lg border border-border overflow-hidden">
              {/* Search input */}
              <div className="relative border-b border-border">
                <svg
                  className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path strokeLinecap="round" d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  value={ruleFilter}
                  onChange={(e) => setRuleFilter(e.target.value)}
                  placeholder="Filter rules..."
                  aria-label="Filter rules"
                  className="w-full bg-surface-overlay py-1.5 pl-8 pr-3 text-xs text-text placeholder:text-text-muted focus:bg-surface-hover focus:outline-none"
                />
              </div>

              {/* Scrollable checklist */}
              <div className="max-h-64 select-none overflow-y-auto overscroll-contain">
                {filteredRules.map((rule) => {
                  const isEnabled = config.enabledRules.includes(rule.name);
                  const checkboxId = `rule-${rule.name}`;
                  return (
                    <div
                      key={rule.name}
                      className="flex items-start gap-3 px-3 py-2.5 hover:bg-surface-overlay/50 transition-colors"
                    >
                      <input
                        id={checkboxId}
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => {
                          const next = isEnabled
                            ? config.enabledRules.filter((r) => r !== rule.name)
                            : [...config.enabledRules, rule.name];
                          onChange({ ...config, enabledRules: next });
                        }}
                        className="accent-primary mt-0.5 h-4 w-4 rounded"
                      />
                      <label
                        htmlFor={checkboxId}
                        className="flex flex-col gap-0.5 cursor-pointer"
                      >
                        <span className="text-sm text-text">
                          <InlineMarkdown text={rule.displayName} />
                        </span>
                        <span className="text-xs text-text-muted leading-relaxed">
                          <InlineMarkdown text={rule.description} />
                        </span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Suggest a rule link */}
            <a
              href="https://github.com/Spillgebees/transmodel-validator/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text"
            >
              Suggest a rule
              {/* External link icon */}
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"
                />
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Searchable XSD picker ────────────────────────────────────────── */

function SearchableXsdPicker({
  files,
  value,
  onSelect,
}: {
  files: string[];
  value: string | undefined;
  onSelect: (xsd: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? files.filter((f) => f.toLowerCase().includes(query.toLowerCase()))
    : files;

  // Close dropdown when clicking outside.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset highlight when filtered list changes.
  useEffect(() => {
    setHighlightIndex(0);
  }, []);

  // Scroll highlighted item into view.
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const item = listRef.current.children[highlightIndex] as
      | HTMLElement
      | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, isOpen]);

  const selectItem = (xsd: string) => {
    onSelect(xsd);
    setQuery("");
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[highlightIndex]) {
          selectItem(filtered[highlightIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className="flex flex-col gap-2" ref={containerRef}>
      <label
        className="text-xs font-medium text-text-muted"
        htmlFor="xsd-search-input"
      >
        Root XSD
        <span className="ml-1 font-normal text-text-muted">
          ({files.length} files found)
        </span>
      </label>
      <div className="relative">
        {/* Search input / selected value display */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: presentation wrapper delegates focus to inner input */}
        <div
          role="presentation"
          className="flex items-center rounded-md bg-surface-raised transition-colors focus-within:ring-1 focus-within:ring-primary"
          onClick={() => {
            setIsOpen(true);
            inputRef.current?.focus();
          }}
        >
          {/* Search icon */}
          <svg
            className="ml-2.5 h-3.5 w-3.5 shrink-0 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="m21 21-4.3-4.3" />
          </svg>
          <input
            id="xsd-search-input"
            ref={inputRef}
            type="text"
            value={isOpen ? query : (value ?? "")}
            placeholder={value ? value : "Search XSD files..."}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => {
              setIsOpen(true);
              setQuery("");
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent px-2 py-1.5 font-mono text-sm text-text placeholder:text-text-muted focus:outline-none"
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-controls="xsd-listbox"
          />
          {/* Clear button when a value is selected */}
          {value && !isOpen && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect("");
                setQuery("");
                inputRef.current?.focus();
              }}
              className="mr-2 shrink-0 text-text-muted transition-colors hover:text-text"
              aria-label="Clear selection"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Dropdown list */}
        {isOpen && (
          <div
            ref={listRef}
            id="xsd-listbox"
            role="listbox"
            className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-surface-raised py-1 shadow-lg"
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-text-muted">
                No files matching &ldquo;{query}&rdquo;
              </div>
            ) : (
              filtered.map((xsd, i) => (
                // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard navigation handled by combobox input's onKeyDown
                <div
                  key={xsd}
                  role="option"
                  tabIndex={-1}
                  aria-selected={xsd === value}
                  className={`cursor-pointer px-3 py-1.5 font-mono text-xs transition-colors ${
                    i === highlightIndex
                      ? "bg-primary/15 text-primary"
                      : xsd === value
                        ? "text-primary"
                        : "text-text hover:bg-surface-hover"
                  }`}
                  onMouseEnter={() => setHighlightIndex(i)}
                  onClick={() => selectItem(xsd)}
                >
                  {xsd}
                </div>
              ))
            )}
          </div>
        )}
      </div>
      <p className="text-xs leading-relaxed text-text-muted">
        Choose the main schema file that includes/imports the others
      </p>
    </div>
  );
}

/* ── Schema version picker (custom combobox) ─────────────────────── */

/** Special options shown at the bottom of the schema picker. */
const SPECIAL_OPTIONS = [
  { id: "none", label: "None (rules only)" },
  { id: "custom", label: "Custom (.xsd / .zip)" },
] as const;

/** Resolves display label for a given schema ID. */
function getSchemaLabel(
  schemas: readonly SchemaVersionDescriptor[],
  value: string,
): string {
  const special = SPECIAL_OPTIONS.find((o) => o.id === value);
  if (special) return special.label;
  const found = schemas.find((s) => s.id === value);
  if (found) return found.label;
  // Fall back to raw value (e.g. stale schemaId after format change).
  return value;
}

/** Returns true when the schemas span multiple formats (needs grouping). */
function hasMultipleFormats(
  schemas: readonly SchemaVersionDescriptor[],
): boolean {
  const formats = new Set(schemas.map((s) => s.format));
  return formats.size > 1;
}

type PickerItem =
  | { id: string; label: string; kind: "schema"; format: string }
  | { id: string; label: string; kind: "special" };

function SchemaVersionPicker({
  schemas,
  value,
  onChange,
}: {
  schemas: readonly SchemaVersionDescriptor[];
  value: string;
  onChange: (schemaId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const showGroups = hasMultipleFormats(schemas);

  // Build the flat list of selectable items: filtered schemas + special options.
  const lowerQuery = query.toLowerCase();
  const filteredSchemas = query
    ? schemas.filter((s) => s.label.toLowerCase().includes(lowerQuery))
    : [...schemas];
  const filteredSpecial = query
    ? SPECIAL_OPTIONS.filter((o) => o.label.toLowerCase().includes(lowerQuery))
    : [...SPECIAL_OPTIONS];

  // Build items array used for keyboard navigation and rendering.
  const items: PickerItem[] = [
    ...filteredSchemas.map((s) => ({
      id: s.id,
      label: s.label,
      kind: "schema" as const,
      format: s.format,
    })),
    ...filteredSpecial.map((o) => ({
      id: o.id,
      label: o.label,
      kind: "special" as const,
    })),
  ];

  // Close dropdown when clicking outside.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset highlight when filtered list changes.
  useEffect(() => {
    setHighlightIndex(0);
  }, []);

  // Scroll highlighted item into view.
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const el = listRef.current.querySelector(
      `[data-index="${highlightIndex}"]`,
    ) as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, isOpen]);

  const selectItem = (id: string) => {
    onChange(id);
    setQuery("");
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, items.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (items[highlightIndex]) {
          selectItem(items[highlightIndex].id);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  // Group schemas by format for rendering when showing all.
  const netexItems = filteredSchemas.filter((s) => s.format === "netex");
  const siriItems = filteredSchemas.filter((s) => s.format === "siri");

  // Map item id → flat index (for data-index and highlight).
  let flatIndex = 0;
  const indexMap = new Map<string, number>();
  if (showGroups) {
    for (const s of netexItems) indexMap.set(s.id, flatIndex++);
    for (const s of siriItems) indexMap.set(s.id, flatIndex++);
  } else {
    for (const s of filteredSchemas) indexMap.set(s.id, flatIndex++);
  }
  for (const o of filteredSpecial) indexMap.set(o.id, flatIndex++);

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger area */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: presentation wrapper delegates focus to inner combobox input */}
      <div
        role="presentation"
        className="flex cursor-pointer items-center rounded-md border border-border bg-surface-overlay transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary"
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? query : getSchemaLabel(schemas, value)}
          readOnly={!isOpen}
          placeholder="Search schemas..."
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setQuery("");
          }}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="schema-listbox"
          aria-label="Schema version"
        />
        {/* Chevron icon */}
        <svg
          className={`mr-2.5 h-4 w-4 shrink-0 text-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listRef}
          id="schema-listbox"
          role="listbox"
          className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-surface-raised py-1 shadow-lg"
        >
          {items.length === 0 ? (
            <div className="px-3 py-2 text-xs text-text-muted">
              No schemas matching &ldquo;{query}&rdquo;
            </div>
          ) : (
            <>
              {/* Schema items (grouped when multiple formats) */}
              {showGroups ? (
                <>
                  {netexItems.length > 0 && (
                    <>
                      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted select-none">
                        NeTEx
                      </div>
                      {netexItems.map((s) => {
                        const idx = indexMap.get(s.id) ?? 0;
                        return (
                          // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard navigation handled by combobox input's onKeyDown
                          <div
                            key={s.id}
                            role="option"
                            tabIndex={-1}
                            aria-selected={s.id === value}
                            data-index={idx}
                            className={`cursor-pointer px-3 py-1.5 text-sm transition-colors ${
                              idx === highlightIndex
                                ? "bg-primary/15 text-primary"
                                : s.id === value
                                  ? "text-primary"
                                  : "text-text hover:bg-surface-hover"
                            }`}
                            onMouseEnter={() => setHighlightIndex(idx)}
                            onClick={() => selectItem(s.id)}
                          >
                            {s.label}
                          </div>
                        );
                      })}
                    </>
                  )}
                  {siriItems.length > 0 && (
                    <>
                      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted select-none">
                        SIRI
                      </div>
                      {siriItems.map((s) => {
                        const idx = indexMap.get(s.id) ?? 0;
                        return (
                          // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard navigation handled by combobox input's onKeyDown
                          <div
                            key={s.id}
                            role="option"
                            tabIndex={-1}
                            aria-selected={s.id === value}
                            data-index={idx}
                            className={`cursor-pointer px-3 py-1.5 text-sm transition-colors ${
                              idx === highlightIndex
                                ? "bg-primary/15 text-primary"
                                : s.id === value
                                  ? "text-primary"
                                  : "text-text hover:bg-surface-hover"
                            }`}
                            onMouseEnter={() => setHighlightIndex(idx)}
                            onClick={() => selectItem(s.id)}
                          >
                            {s.label}
                          </div>
                        );
                      })}
                    </>
                  )}
                </>
              ) : (
                filteredSchemas.map((s) => {
                  const idx = indexMap.get(s.id) ?? 0;
                  return (
                    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard navigation handled by combobox input's onKeyDown
                    <div
                      key={s.id}
                      role="option"
                      tabIndex={-1}
                      aria-selected={s.id === value}
                      data-index={idx}
                      className={`cursor-pointer px-3 py-1.5 text-sm transition-colors ${
                        idx === highlightIndex
                          ? "bg-primary/15 text-primary"
                          : s.id === value
                            ? "text-primary"
                            : "text-text hover:bg-surface-hover"
                      }`}
                      onMouseEnter={() => setHighlightIndex(idx)}
                      onClick={() => selectItem(s.id)}
                    >
                      {s.label}
                    </div>
                  );
                })
              )}

              {/* Divider before special options */}
              {filteredSpecial.length > 0 && filteredSchemas.length > 0 && (
                <div className="my-1 border-t border-border" />
              )}

              {/* Special options (None, Custom) */}
              {filteredSpecial.map((o) => {
                const idx = indexMap.get(o.id) ?? 0;
                return (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard navigation handled by combobox input's onKeyDown
                  <div
                    key={o.id}
                    role="option"
                    tabIndex={-1}
                    aria-selected={o.id === value}
                    data-index={idx}
                    className={`cursor-pointer px-3 py-1.5 text-sm transition-colors ${
                      idx === highlightIndex
                        ? "bg-primary/15 text-primary"
                        : o.id === value
                          ? "text-primary"
                          : "text-text hover:bg-surface-hover"
                    }`}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    onClick={() => selectItem(o.id)}
                  >
                    {o.label}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
