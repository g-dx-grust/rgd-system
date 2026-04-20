"use client";

import { useState } from "react";
import type { DeficiencyRequestRow } from "@/server/repositories/specialist";

interface Props {
  caseId: string;
  initialDeficiencies: DeficiencyRequestRow[];
  canResolve: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  open:      "未対応",
  responded: "対応済み（確認待ち）",
  resolved:  "解決済み",
};

const STATUS_COLORS: Record<string, string> = {
  open:      "text-[#DC2626] bg-red-50 border-red-200",
  responded: "text-[#CA8A04] bg-yellow-50 border-yellow-200",
  resolved:  "text-[#16A34A] bg-green-50 border-green-200",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

function formatDateTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

export function DeficienciesInternalClient({ caseId, initialDeficiencies, canResolve }: Props) {
  const [deficiencies, setDeficiencies] = useState<DeficiencyRequestRow[]>(initialDeficiencies);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const openCount      = deficiencies.filter((d) => d.status === "open").length;
  const respondedCount = deficiencies.filter((d) => d.status === "responded").length;

  async function handleResolve(id: string) {
    setResolvingId(id);
    setError(null);

    const res = await fetch(`/api/cases/${caseId}/deficiencies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });

    setResolvingId(null);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "更新に失敗しました");
      return;
    }

    setDeficiencies((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, status: "resolved", resolvedAt: new Date().toISOString() } : d
      )
    );
  }

  return (
    <div className="space-y-4">
      {/* サマリーバー */}
      {deficiencies.length > 0 && (
        <div className="flex flex-wrap gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-5 py-3">
          <span className="text-sm text-[var(--color-text-sub)]">
            合計: <strong>{deficiencies.length}</strong> 件
          </span>
          {openCount > 0 && (
            <span className="text-sm text-[#DC2626] font-medium">
              未対応: {openCount} 件
            </span>
          )}
          {respondedCount > 0 && (
            <span className="text-sm text-[#CA8A04] font-medium">
              確認待ち: {respondedCount} 件
            </span>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-[var(--radius-sm)] border border-red-200 bg-red-50 px-3 py-2 text-sm text-[#DC2626]">
          {error}
        </p>
      )}

      {deficiencies.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-5 py-12 text-center text-sm text-[var(--color-text-muted)]">
          不備依頼はまだありません
        </div>
      ) : (
        <div className="space-y-3">
          {deficiencies.map((d) => (
            <div
              key={d.id}
              className={[
                "rounded-[var(--radius-md)] border bg-white p-5 space-y-3",
                d.status === "open"      ? "border-red-200"    :
                d.status === "responded" ? "border-yellow-200" :
                "border-[var(--color-border)]",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)] whitespace-pre-wrap">
                    {d.description}
                  </p>
                  {d.createdByName && (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      登録者: {d.createdByName}（社労士）
                    </p>
                  )}
                </div>
                <span
                  className={[
                    "flex-shrink-0 rounded-[var(--radius-sm)] border px-2 py-0.5 text-xs font-medium",
                    STATUS_COLORS[d.status] ?? "",
                  ].join(" ")}
                >
                  {STATUS_LABELS[d.status] ?? d.status}
                </span>
              </div>

              {d.requiredFiles.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">必要ファイル</p>
                  <ul className="space-y-1">
                    {d.requiredFiles.map((f, i) => (
                      <li key={i} className="text-sm text-[var(--color-text-sub)]">
                        • {f.label}
                        {f.note && (
                          <span className="ml-1 text-xs text-[var(--color-text-muted)]">({f.note})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--color-text-muted)]">
                <span>登録: {formatDateTime(d.createdAt)}</span>
                {d.deadline && (
                  <span
                    className={
                      new Date(d.deadline) < new Date() && d.status !== "resolved"
                        ? "text-[#DC2626] font-medium"
                        : ""
                    }
                  >
                    期限: {formatDate(d.deadline)}
                    {new Date(d.deadline) < new Date() && d.status !== "resolved" && " ⚠ 期限超過"}
                  </span>
                )}
                {d.respondedAt && (
                  <span>社労士対応済み: {formatDateTime(d.respondedAt)}</span>
                )}
                {d.resolvedAt && (
                  <span>解決済み: {formatDateTime(d.resolvedAt)}</span>
                )}
                {d.resolvedByName && (
                  <span>解決者: {d.resolvedByName}</span>
                )}
              </div>

              {canResolve && d.status === "responded" && (
                <button
                  onClick={() => handleResolve(d.id)}
                  disabled={resolvingId === d.id}
                  className="rounded-[var(--radius-sm)] bg-[#16A34A] px-3 py-1 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {resolvingId === d.id ? "処理中…" : "解決済みにする"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
