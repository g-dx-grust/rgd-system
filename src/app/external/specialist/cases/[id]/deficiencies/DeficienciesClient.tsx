"use client";

import { useState } from "react";
import type { DeficiencyRequestRow, RequiredFileItem } from "@/server/repositories/specialist";

interface Props {
  caseId: string;
  initialDeficiencies: DeficiencyRequestRow[];
}

const STATUS_LABELS: Record<string, string> = {
  open:      "未対応",
  responded: "対応済み",
  resolved:  "確認済み",
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

export function DeficienciesClient({ caseId, initialDeficiencies }: Props) {
  const [deficiencies, setDeficiencies] = useState<DeficiencyRequestRow[]>(initialDeficiencies);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フォーム state
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [requiredFiles, setRequiredFiles] = useState<RequiredFileItem[]>([{ label: "", note: "" }]);

  function addFileRow() {
    setRequiredFiles((prev) => [...prev, { label: "", note: "" }]);
  }

  function removeFileRow(i: number) {
    setRequiredFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateFileRow(i: number, field: keyof RequiredFileItem, value: string) {
    setRequiredFiles((prev) =>
      prev.map((f, idx) => (idx === i ? { ...f, [field]: value } : f))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setSubmitting(true);
    setError(null);

    const validFiles = requiredFiles.filter((f) => f.label.trim());

    try {
      const res = await fetch(`/api/specialist/cases/${caseId}/deficiencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description:    description.trim(),
          required_files: validFiles,
          deadline:       deadline || null,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "登録に失敗しました");
        return;
      }

      // 一覧を再取得
      const listRes = await fetch(`/api/specialist/cases/${caseId}/deficiencies`);
      if (listRes.ok) {
        const j = await listRes.json();
        setDeficiencies(j.deficiencies ?? []);
      }

      setDescription("");
      setDeadline("");
      setRequiredFiles([{ label: "", note: "" }]);
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRespond(id: string) {
    setError(null);
    const res = await fetch(`/api/specialist/cases/${caseId}/deficiencies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "responded" }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "更新に失敗しました");
      return;
    }
    setDeficiencies((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, status: "responded", respondedAt: new Date().toISOString() } : d
      )
    );
  }

  return (
    <div className="space-y-4">
      {/* 操作バー */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-sub)]">
          計 {deficiencies.length} 件
          {deficiencies.filter((d) => d.status === "open").length > 0 && (
            <span className="ml-2 text-[#DC2626] font-medium">
              未対応 {deficiencies.filter((d) => d.status === "open").length} 件
            </span>
          )}
        </p>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            + 不備依頼を入力
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-[var(--radius-sm)] border border-red-200 bg-red-50 px-3 py-2 text-sm text-[#DC2626]">
          {error}
        </p>
      )}

      {/* 入力フォーム */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white p-5"
        >
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            労働局からの不備依頼を入力
          </h2>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--color-text-sub)]">
              不備内容 <span className="text-[#DC2626]">*</span>
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="労働局から指摘された不備内容を詳しく記入してください"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] resize-y"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--color-text-sub)]">
              対応期限
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-[var(--color-text-sub)]">
              必要ファイル（複数可）
            </label>
            {requiredFiles.map((f, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input
                  type="text"
                  placeholder="ファイル名・書類名"
                  value={f.label}
                  onChange={(e) => updateFileRow(i, "label", e.target.value)}
                  className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
                />
                <input
                  type="text"
                  placeholder="補足（任意）"
                  value={f.note ?? ""}
                  onChange={(e) => updateFileRow(i, "note", e.target.value)}
                  className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
                />
                {requiredFiles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeFileRow(i)}
                    className="flex-shrink-0 text-[var(--color-text-muted)] hover:text-[#DC2626] text-sm px-1"
                  >
                    削除
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addFileRow}
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              + 行を追加
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting || !description.trim()}
              className="rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
            >
              {submitting ? "登録中…" : "訓練会社へ送信"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-4 py-1.5 text-sm text-[var(--color-text-sub)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}

      {/* 一覧 */}
      {deficiencies.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-5 py-10 text-center text-sm text-[var(--color-text-muted)]">
          不備依頼はまだありません
        </div>
      ) : (
        <div className="space-y-3">
          {deficiencies.map((d) => (
            <div
              key={d.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)] whitespace-pre-wrap">
                    {d.description}
                  </p>
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
                          <span className="ml-1 text-xs text-[var(--color-text-muted)]">
                            ({f.note})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--color-text-muted)]">
                <span>登録日: {formatDateTime(d.createdAt)}</span>
                {d.deadline && (
                  <span className={new Date(d.deadline) < new Date() && d.status !== "resolved" ? "text-[#DC2626] font-medium" : ""}>
                    期限: {formatDate(d.deadline)}
                  </span>
                )}
                {d.respondedAt && (
                  <span>対応済み日時: {formatDateTime(d.respondedAt)}</span>
                )}
                {d.resolvedAt && (
                  <span>確認済み日時: {formatDateTime(d.resolvedAt)}</span>
                )}
              </div>

              {d.status === "open" && (
                <button
                  onClick={() => handleRespond(d.id)}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-accent)] px-3 py-1 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent-tint)] transition-colors"
                >
                  対応済みにする
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
