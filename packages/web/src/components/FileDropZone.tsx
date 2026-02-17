import { useCallback, useRef, useState } from "react";
import type { SelectedFile } from "~/lib/types";

const ARCHIVE_EXTENSIONS = [
  ".zip",
  ".gz",
  ".tar",
  ".tgz",
  ".tbz2",
  ".tar.gz",
  ".tar.bz2",
];

function isArchiveFile(name: string): boolean {
  const lower = name.toLowerCase();
  return ARCHIVE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

interface FileDropZoneProps {
  onFilesAdded: (files: SelectedFile[]) => void;
  disabled?: boolean;
}

export function FileDropZone({ onFilesAdded, disabled }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    (fileList: FileList) => {
      const newFiles: SelectedFile[] = Array.from(fileList).map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        file,
        isArchive: isArchiveFile(file.name),
      }));
      onFilesAdded(newFiles);
    },
    [onFilesAdded],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [disabled, processFiles],
  );

  return (
    // biome-ignore lint/a11y/useSemanticElements: div is used for drag-and-drop support which button does not support
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="Drop XML files here or click to browse"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!disabled) inputRef.current?.click();
        }
      }}
      className={`
        flex cursor-pointer flex-col items-center justify-center gap-3
        rounded-lg border-2 border-dashed py-12 text-center transition-colors
        ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-text-muted"}
        ${disabled ? "pointer-events-none opacity-50" : ""}
      `}
    >
      {/* Upload icon */}
      <svg
        className="h-8 w-8 text-text-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
        />
      </svg>
      <p className="text-sm text-text">
        Drop XML files here or click to browse
      </p>
      <p className="text-xs text-text-muted">.xml, .zip, .gz, .tar, .bz2</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".xml,.zip,.gz,.tar,.bz2,.tgz,.tbz2"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) processFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
