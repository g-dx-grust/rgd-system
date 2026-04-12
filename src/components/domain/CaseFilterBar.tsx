"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useRef, useTransition } from "react";
import { CASE_STATUS_OPTIONS } from "@/lib/constants/case-status";

interface UserOption {
  id: string;
  displayName: string;
}

interface Props {
  users: UserOption[];
  currentStatus: string;
  currentOwner: string;
  currentSearch: string;
  currentView?: string;
  viewLabel?: string;
}

/**
 * 案件一覧フィルターバー（クライアントコンポーネント）
 *
 * URLサーチパラメータを更新することでサーバー側でフィルタリングを行う。
 */
export function CaseFilterBar({ users, currentStatus, currentOwner, currentSearch, currentView, viewLabel }: Props) {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page"); // フィルタ変更時はページを1に戻す
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* ダッシュボードからのビューフィルター表示 */}
      {currentView && viewLabel && (
        <span className="inline-flex items-center h-8 px-3 text-xs font-medium text-[var(--color-accent)] bg-[var(--color-accent-tint)] border border-[var(--color-accent)] rounded-[var(--radius-sm)]">
          {viewLabel}
        </span>
      )}

      {/* 検索 */}
      <input
        type="search"
        defaultValue={currentSearch}
        placeholder="案件名・管理番号で検索"
        className={[
          "h-8 px-3 text-sm",
          "border border-[var(--color-border)] rounded-[var(--radius-sm)]",
          "bg-white text-[var(--color-text)]",
          "placeholder:text-[var(--color-text-muted)]",
          "focus:outline-none focus:border-[var(--color-accent)]",
          "w-48",
        ].join(" ")}
        onChange={(e) => {
          const v = e.target.value;
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => updateParam("search", v), 300);
        }}
      />

      {/* ステータスフィルター */}
      <select
        value={currentStatus}
        onChange={(e) => updateParam("status", e.target.value)}
        className={[
          "h-8 px-2 text-sm",
          "border border-[var(--color-border)] rounded-[var(--radius-sm)]",
          "bg-white text-[var(--color-text)]",
          "focus:outline-none focus:border-[var(--color-accent)]",
        ].join(" ")}
        aria-label="ステータスで絞り込む"
      >
        <option value="">すべてのステータス</option>
        {CASE_STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* 担当者フィルター */}
      <select
        value={currentOwner}
        onChange={(e) => updateParam("owner", e.target.value)}
        className={[
          "h-8 px-2 text-sm",
          "border border-[var(--color-border)] rounded-[var(--radius-sm)]",
          "bg-white text-[var(--color-text)]",
          "focus:outline-none focus:border-[var(--color-accent)]",
        ].join(" ")}
        aria-label="担当者で絞り込む"
      >
        <option value="">すべての担当者</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.displayName}
          </option>
        ))}
      </select>

      {/* リセット */}
      {(currentStatus || currentOwner || currentSearch || currentView) && (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="h-8 px-3 text-xs text-[var(--color-text-sub)] hover:text-[var(--color-text)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-white"
        >
          クリア
        </button>
      )}
    </div>
  );
}
