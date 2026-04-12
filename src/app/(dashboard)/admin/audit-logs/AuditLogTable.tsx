"use client";

import Link from "next/link";
import type { AuditLogRow } from "@/server/repositories/audit-log";

interface AuditLogTableProps {
  logs: AuditLogRow[];
  actionLabels: Record<string, string>;
  totalPages: number;
  currentPage: number;
  action: string;
  dateFrom: string;
  dateTo: string;
}

export function AuditLogTable({
  logs,
  actionLabels,
  totalPages,
  currentPage,
  action,
  dateFrom,
  dateTo,
}: AuditLogTableProps) {
  if (logs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
        条件に一致するログがありません
      </p>
    );
  }

  const buildPageUrl = (page: number) => {
    const p = new URLSearchParams();
    if (action)   p.set("action",   action);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo)   p.set("dateTo",   dateTo);
    if (page > 1) p.set("page", String(page));
    const q = p.toString();
    return `/admin/audit-logs${q ? `?${q}` : ""}`;
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="py-2 pr-4 text-left text-xs font-medium text-[var(--color-text-muted)] whitespace-nowrap">日時</th>
              <th className="py-2 pr-4 text-left text-xs font-medium text-[var(--color-text-muted)] whitespace-nowrap">操作者</th>
              <th className="py-2 pr-4 text-left text-xs font-medium text-[var(--color-text-muted)] whitespace-nowrap">操作</th>
              <th className="py-2 pr-4 text-left text-xs font-medium text-[var(--color-text-muted)] whitespace-nowrap">対象種別</th>
              <th className="py-2 pr-4 text-left text-xs font-medium text-[var(--color-text-muted)] whitespace-nowrap">対象ID</th>
              <th className="py-2 text-left text-xs font-medium text-[var(--color-text-muted)]">詳細</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr
                key={log.id}
                className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <td className="py-2.5 pr-4 text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                  {formatDatetime(log.createdAt)}
                </td>
                <td className="py-2.5 pr-4 text-sm text-[var(--color-text)] whitespace-nowrap">
                  {log.userDisplayName ?? (
                    <span className="text-[var(--color-text-muted)]">システム</span>
                  )}
                </td>
                <td className="py-2.5 pr-4">
                  <ActionBadge action={log.action} label={actionLabels[log.action] ?? log.action} />
                </td>
                <td className="py-2.5 pr-4 text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                  {log.targetType ?? "—"}
                </td>
                <td className="py-2.5 pr-4 text-xs font-mono text-[var(--color-text-muted)]">
                  {log.targetId ? (
                    log.targetType === "case" ? (
                      <Link
                        href={`/cases/${log.targetId}`}
                        className="text-[var(--color-accent)] hover:underline"
                      >
                        {log.targetId.slice(0, 8)}…
                      </Link>
                    ) : (
                      <span>{log.targetId.slice(0, 8)}…</span>
                    )
                  ) : "—"}
                </td>
                <td className="py-2.5 text-xs text-[var(--color-text-muted)] max-w-[200px] truncate">
                  {log.metadata ? JSON.stringify(log.metadata) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-2">
          {currentPage > 1 && (
            <a
              href={buildPageUrl(currentPage - 1)}
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
              href={buildPageUrl(currentPage + 1)}
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

function ActionBadge({ action, label }: { action: string; label: string }) {
  const isAuth    = action.startsWith("login") || action.startsWith("logout");
  const isDelete  = action.includes("delete") || action.includes("deactivate");
  const isError   = action.includes("failed");
  const isBulk    = action.startsWith("bulk_");

  const className = isError
    ? "bg-[#FEF2F2] text-[#991B1B]"
    : isDelete
    ? "bg-[#FFFBEB] text-[#92400E]"
    : isBulk
    ? "bg-[#EDE9FE] text-[#5B21B6]"
    : isAuth
    ? "bg-[#F0FDF4] text-[#166534]"
    : "bg-[#EFF6FF] text-[#1D4ED8]";

  return (
    <span className={`inline-block rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${className}`}>
      {label}
    </span>
  );
}

function formatDatetime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}
