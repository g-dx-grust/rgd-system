"use client";

import { useEffect } from "react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("[dashboard] error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4 max-w-sm">
        <p className="text-sm font-medium text-[var(--color-text)]">
          ページの読み込みに失敗しました
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {error.message ?? "予期しないエラーが発生しました。"}
        </p>
        <button
          type="button"
          onClick={reset}
          className="h-8 px-4 text-xs font-medium rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          再試行
        </button>
      </div>
    </div>
  );
}
