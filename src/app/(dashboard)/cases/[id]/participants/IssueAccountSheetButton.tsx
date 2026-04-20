"use client";

import { useState } from "react";

interface Props {
  caseId: string;
  disabled?: boolean;
}

export function IssueAccountSheetButton({ caseId, disabled }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/account-sheet`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "ダウンロードに失敗しました。");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const utf8Match   = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const asciiMatch  = disposition.match(/filename="([^"]+)"/i);
      const filename    = utf8Match
        ? decodeURIComponent(utf8Match[1])
        : asciiMatch?.[1] ?? "アカウント発行シート.docx";

      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("ダウンロードに失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={disabled || loading}
        className={[
          "inline-flex items-center gap-1.5",
          "px-3 py-1.5 text-sm font-medium",
          "border border-[var(--color-border-strong)]",
          "rounded-[var(--radius-sm)]",
          "transition-colors duration-100",
          disabled || loading
            ? "opacity-50 cursor-not-allowed bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]"
            : "bg-white text-[var(--color-text-sub)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]",
        ].join(" ")}
      >
        <DownloadIcon />
        {loading ? "生成中…" : "アカウント発行シート発行"}
      </button>
      {disabled && !error && (
        <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
          受講者を登録してから発行できます
        </p>
      )}
      {error && (
        <p className="mt-1.5 text-xs text-[#DC2626]">{error}</p>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
