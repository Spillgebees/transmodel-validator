/**
 * Renders inline markdown syntax: `code`, **bold**, and *italic*.
 *
 * Returns plain text if no markdown syntax is found. Used primarily
 * in validation result messages where rule output contains lightweight
 * inline formatting.
 */

interface InlineMarkdownProps {
  text: string;
}

export function InlineMarkdown({ text }: InlineMarkdownProps) {
  // Split on backtick-code, **bold**, or *italic* (in that priority order).
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded bg-surface-overlay px-1.5 py-0.5 font-mono text-text-secondary"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
