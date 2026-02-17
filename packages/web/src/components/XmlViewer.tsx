/**
 * Syntax-highlighted XML viewer with line numbers and error highlighting.
 *
 * Accepts a sparse line map (only the lines near errors) and renders
 * them with "..." gap indicators between non-contiguous ranges.
 */

import type { XmlSnippet } from "~/lib/types";

interface XmlViewerProps {
  /** Sparse line map: line number (1-indexed) -> line content. */
  snippet: XmlSnippet;
  /** Line numbers to highlight as errors (1-indexed). */
  errorLines: number[];
  /** Center the view around this line. */
  focusLine?: number;
  /** When true, renders without outer border/rounding (for embedding). */
  borderless?: boolean;
}

export function XmlViewer({
  snippet,
  errorLines,
  focusLine,
  borderless,
}: XmlViewerProps) {
  // Sort available line numbers.
  const lineNums = Object.keys(snippet)
    .map(Number)
    .sort((a, b) => a - b);

  if (lineNums.length === 0) return null;

  // If we have a focus line, only show lines within ±3 of it.
  const displayLines = focusLine
    ? lineNums.filter((ln) => ln >= focusLine - 3 && ln <= focusLine + 3)
    : lineNums;

  if (displayLines.length === 0) return null;

  const errorLineSet = new Set(errorLines);

  // Build render items: lines and gap indicators.
  const items: Array<
    { type: "line"; num: number; text: string } | { type: "gap" }
  > = [];
  for (let i = 0; i < displayLines.length; i++) {
    // Add gap if there's a break in line numbers.
    if (i > 0 && displayLines[i] - displayLines[i - 1] > 1) {
      items.push({ type: "gap" });
    }
    items.push({
      type: "line",
      num: displayLines[i],
      text: snippet[displayLines[i]],
    });
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: region role provides accessible labeling for this XML viewer container
    <div
      className={`overflow-x-auto ${borderless ? "border-t border-border bg-surface-overlay/30" : "rounded-lg border border-border bg-surface-overlay/50"}`}
      role="region"
      aria-label="Source XML context"
    >
      <pre className="min-w-[500px]">
        {items.map((item, i) => {
          if (item.type === "gap") {
            return (
              <div
                key={`gap-${i}`}
                className="flex font-mono text-sm leading-7 border-l-[3px] border-l-transparent"
              >
                <span className="flex w-14 shrink-0 select-none items-center justify-end pr-4 text-xs text-text-dim/30">
                  ···
                </span>
              </div>
            );
          }

          const isError = errorLineSet.has(item.num);
          return (
            <div
              key={item.num}
              className={`flex items-stretch font-mono text-sm leading-7 ${
                isError
                  ? "border-l-[3px] border-l-error bg-error/10"
                  : "border-l-[3px] border-l-transparent"
              }`}
            >
              <span
                className={`flex w-14 shrink-0 select-none items-center justify-end pr-4 text-xs ${
                  isError ? "font-semibold text-error" : "text-text-muted"
                }`}
                aria-hidden="true"
              >
                {item.num}
              </span>
              <code className="flex-1 whitespace-pre pr-4">
                <XmlSyntax text={item.text} />
              </code>
            </div>
          );
        })}
      </pre>
    </div>
  );
}

/**
 * Very simple regex-based XML syntax highlighter.
 */
function XmlSyntax({ text }: { text: string }) {
  const tokens = tokenizeXml(text);
  return (
    <>
      {tokens.map((t, i) => (
        <span key={i} className={tokenClass(t.type)}>
          {t.text}
        </span>
      ))}
    </>
  );
}

type TokenType = "tag" | "attr" | "val" | "comment" | "text";

interface Token {
  type: TokenType;
  text: string;
}

function tokenClass(type: TokenType): string {
  switch (type) {
    case "tag":
      return "text-primary"; // blue
    case "attr":
      return "text-[#7da0c2]"; // slate-blue
    case "val":
      return "text-[#e6922e]"; // orange
    case "comment":
      return "italic text-text-dim";
    default:
      return "text-text";
  }
}

function tokenizeXml(line: string): Token[] {
  const tokens: Token[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    // Comment
    const commentMatch = remaining.match(/^(<!--[\s\S]*?(?:-->|$))/);
    if (commentMatch) {
      tokens.push({ type: "comment", text: commentMatch[1] });
      remaining = remaining.slice(commentMatch[1].length);
      continue;
    }

    // Opening/closing/self-closing tag with attributes
    const tagMatch = remaining.match(
      /^(<\/?[\w:.-]+)((?:\s+[\w:.-]+\s*=\s*"[^"]*"|\s+[\w:.-]+\s*=\s*'[^']*')*\s*)(\/?>)/,
    );
    if (tagMatch) {
      tokens.push({ type: "tag", text: tagMatch[1] });
      let attrs = tagMatch[2];
      while (attrs.length > 0) {
        const attrMatch = attrs.match(
          /^(\s+)([\w:.-]+)(\s*=\s*)("[^"]*"|'[^']*')/,
        );
        if (attrMatch) {
          tokens.push({ type: "text", text: attrMatch[1] });
          tokens.push({ type: "attr", text: attrMatch[2] });
          tokens.push({ type: "text", text: attrMatch[3] });
          tokens.push({ type: "val", text: attrMatch[4] });
          attrs = attrs.slice(attrMatch[0].length);
        } else {
          tokens.push({ type: "text", text: attrs });
          break;
        }
      }
      tokens.push({ type: "tag", text: tagMatch[3] });
      remaining = remaining.slice(tagMatch[0].length);
      continue;
    }

    // Simple tag like </Foo> or just >
    const simpleTag = remaining.match(/^(<\/?[\w:.-]+\s*>)/);
    if (simpleTag) {
      tokens.push({ type: "tag", text: simpleTag[1] });
      remaining = remaining.slice(simpleTag[1].length);
      continue;
    }

    // Text content (up to next <)
    const textMatch = remaining.match(/^([^<]+)/);
    if (textMatch) {
      tokens.push({ type: "text", text: textMatch[1] });
      remaining = remaining.slice(textMatch[1].length);
      continue;
    }

    // Fallback: single character
    tokens.push({ type: "text", text: remaining[0] });
    remaining = remaining.slice(1);
  }

  return tokens;
}
