/**
 * 外部向けレイアウト（顧客提出画面）
 *
 * 内部ダッシュボードとは完全に分離。
 * 認証不要。最小限のブランディングのみ表示。
 */

import type { ReactNode } from "react";

export default function ExternalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)]">
      {/* 最小限のヘッダー */}
      <header className="bg-white border-b border-[var(--color-border)] h-14 flex items-center px-6">
        <span className="text-base font-semibold text-[var(--color-text)]">
          RGDシステム
        </span>
        <span className="ml-2 text-xs text-[var(--color-text-muted)]">
          書類提出フォーム
        </span>
      </header>
      <main className="py-10 px-4">
        {children}
      </main>
    </div>
  );
}
