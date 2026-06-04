"use client";

/**
 * FileDropzone
 *
 * クリック／ドラッグ&ドロップでファイルを選択する共通ドロップゾーン。
 * 複数ファイル対応。選択されたファイルは onFiles(File[]) で親に渡す。
 */

import { useCallback, useRef, useState } from "react";

interface Props {
  onFiles:    (files: File[]) => void;
  disabled?:  boolean;
  multiple?:  boolean;
  accept?:    string;
  hint?:      string;
  /** 余白を詰めたコンパクト表示（項目内に置く場合など） */
  compact?:   boolean;
}

const DEFAULT_ACCEPT = [
  ".pdf", ".jpg", ".jpeg", ".png", ".webp",
  ".txt", ".csv", ".xlsx", ".zip",
].join(",");

const DEFAULT_HINT = "PDF / 画像（JPG・PNG・WebP）/ テキスト / CSV / XLSX / ZIP（最大100MB）";

export function FileDropzone({
  onFiles,
  disabled = false,
  multiple = true,
  accept = DEFAULT_ACCEPT,
  hint = DEFAULT_HINT,
  compact = false,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const emit = useCallback(
    (list: FileList | null) => {
      const files = Array.from(list ?? []);
      if (files.length > 0) onFiles(files);
    },
    [onFiles]
  );

  return (
    <div
      className={[
        "border-2 border-dashed rounded-[var(--radius-md)] text-center transition-colors",
        compact ? "p-4" : "p-6",
        disabled
          ? "opacity-60 cursor-not-allowed"
          : "cursor-pointer",
        isDragging
          ? "border-[var(--color-accent)] bg-[var(--color-accent-tint)]"
          : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]",
      ].join(" ")}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!disabled) emit(e.dataTransfer.files);
      }}
      onClick={() => { if (!disabled) inputRef.current?.click(); }}
      role="button"
      tabIndex={0}
      aria-label="ファイルをドロップまたはクリックして選択"
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) inputRef.current?.click();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => { emit(e.target.files); e.target.value = ""; }}
      />
      <p className="text-sm text-[var(--color-text)]">
        <span className="font-medium text-[var(--color-accent)]">クリック</span>
        またはドラッグ&ドロップでファイルを選択
      </p>
      {hint && (
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>
      )}
    </div>
  );
}
