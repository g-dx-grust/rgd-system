"use client";

/**
 * 通知一覧クライアントコンポーネント
 *
 * 既読操作・一括既読をクライアント側で処理し、
 * 完了後に画面をリフレッシュする。
 */

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { NotificationRow } from "@/server/repositories/notifications";

const CATEGORY_STYLES: Record<string, string> = {
  info:    "bg-[#EFF6FF] text-[#1D4ED8]",
  warning: "bg-[#FFFBEB] text-[#92400E]",
  error:   "bg-[#FEF2F2] text-[#991B1B]",
  task:    "bg-[#F0FDF4] text-[#166534]",
};

const CATEGORY_LABELS: Record<string, string> = {
  info:    "お知らせ",
  warning: "警告",
  error:   "エラー",
  task:    "タスク",
};

interface NotificationListProps {
  notifications: NotificationRow[];
  totalPages: number;
  currentPage: number;
  unreadOnly: boolean;
}

export function NotificationList({
  notifications,
  totalPages,
  currentPage,
  unreadOnly,
}: NotificationListProps) {
  const router = useRouter();

  const handleMarkRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    router.refresh();
  };

  const handleMarkAllRead = async () => {
    await fetch("/api/notifications/read-all", { method: "POST" });
    router.refresh();
  };

  if (notifications.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
        {unreadOnly ? "未読の通知はありません" : "通知はありません"}
      </p>
    );
  }

  const baseFilter = unreadOnly ? "?filter=unread" : "";

  return (
    <div className="space-y-3">
      {/* 一括既読ボタン */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleMarkAllRead}
          className="text-xs text-[var(--color-accent)] hover:underline"
        >
          すべて既読にする
        </button>
      </div>

      {/* 通知リスト */}
      <ul className="divide-y divide-[var(--color-border)]">
        {notifications.map((n) => (
          <li
            key={n.id}
            className={[
              "py-3 flex gap-3",
              !n.isRead ? "bg-[var(--color-accent-tint)]" : "",
            ].join(" ")}
          >
            {/* カテゴリバッジ */}
            <span
              className={[
                "flex-shrink-0 mt-0.5 rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[11px] font-medium h-fit",
                CATEGORY_STYLES[n.category] ?? CATEGORY_STYLES["info"],
              ].join(" ")}
            >
              {CATEGORY_LABELS[n.category] ?? n.category}
            </span>

            {/* 本文 */}
            <div className="flex-1 min-w-0">
              {n.linkUrl ? (
                <Link
                  href={n.linkUrl}
                  className="text-sm font-medium text-[var(--color-text)] hover:text-[var(--color-accent)] line-clamp-2"
                >
                  {n.title}
                </Link>
              ) : (
                <p className="text-sm font-medium text-[var(--color-text)] line-clamp-2">
                  {n.title}
                </p>
              )}
              {n.body && (
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)] line-clamp-2">
                  {n.body}
                </p>
              )}
              <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                {formatDatetime(n.createdAt)}
              </p>
            </div>

            {/* 既読ボタン */}
            {!n.isRead && (
              <button
                type="button"
                onClick={() => handleMarkRead(n.id)}
                className="flex-shrink-0 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] self-start mt-0.5"
                aria-label="既読にする"
              >
                既読
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-2">
          {currentPage > 1 && (
            <a
              href={`/notifications${baseFilter}${baseFilter ? "&" : "?"}page=${currentPage - 1}`}
              className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-[var(--radius-sm)] hover:bg-[var(--color-bg-secondary)]"
            >
              ← 前
            </a>
          )}
          <span className="px-3 py-1.5 text-sm text-[var(--color-text-muted)]">
            {currentPage} / {totalPages}
          </span>
          {currentPage < totalPages && (
            <a
              href={`/notifications${baseFilter}${baseFilter ? "&" : "?"}page=${currentPage + 1}`}
              className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-[var(--radius-sm)] hover:bg-[var(--color-bg-secondary)]"
            >
              次 →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function formatDatetime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
