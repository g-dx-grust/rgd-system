"use client";

/**
 * BulkActionBar
 *
 * 案件一覧の一括操作バー。
 * チェックボックスで選択された案件に対して一括操作を行う。
 *
 * 使い方:
 *   <BulkActionBar
 *     selectedIds={selectedIds}
 *     users={users}
 *     onComplete={() => router.refresh()}
 *   />
 */

import { useState } from "react";
import { Button } from "@/components/ui";

interface UserOption {
  id: string;
  displayName: string;
}

interface BulkActionBarProps {
  selectedIds: string[];
  users: UserOption[];
  onComplete: () => void;
}

type BulkAction = "change_owner" | "add_return_task" | null;

export function BulkActionBar({ selectedIds, users, onComplete }: BulkActionBarProps) {
  const [activeAction, setActiveAction] = useState<BulkAction>(null);
  const [ownerUserId,  setOwnerUserId]  = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  if (selectedIds.length === 0) return null;

  const handleExecute = async () => {
    if (!activeAction) return;
    if (activeAction === "change_owner" && !ownerUserId) {
      setError("担当者を選択してください");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        action:  activeAction,
        caseIds: selectedIds,
      };
      if (activeAction === "change_owner")   body.ownerUserId  = ownerUserId;
      if (activeAction === "add_return_task") body.returnReason = returnReason;

      const res = await fetch("/api/cases/bulk", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setError(json.error ?? "操作に失敗しました");
        return;
      }

      setActiveAction(null);
      setOwnerUserId("");
      setReturnReason("");
      onComplete();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-accent-tint)] px-4 py-3 flex flex-wrap gap-3 items-center">
      <span className="text-sm font-medium text-[var(--color-accent)]">
        {selectedIds.length} 件選択中
      </span>

      {/* アクション選択 */}
      {!activeAction && (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setActiveAction("change_owner")}
          >
            担当者を変更
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setActiveAction("add_return_task")}
          >
            不備再依頼タスクを追加
          </Button>
        </div>
      )}

      {/* 担当者変更フォーム */}
      {activeAction === "change_owner" && (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={ownerUserId}
            onChange={(e) => setOwnerUserId(e.target.value)}
            className="border border-[var(--color-border)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          >
            <option value="">担当者を選択</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.displayName}</option>
            ))}
          </select>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExecute}
            disabled={loading || !ownerUserId}
          >
            {loading ? "実行中…" : "実行"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setActiveAction(null); setError(null); }}
          >
            キャンセル
          </Button>
        </div>
      )}

      {/* 不備再依頼フォーム */}
      {activeAction === "add_return_task" && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            placeholder="不備内容（任意）"
            maxLength={500}
            className="border border-[var(--color-border)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm w-64 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleExecute}
            disabled={loading}
          >
            {loading ? "実行中…" : "タスクを追加"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setActiveAction(null); setError(null); }}
          >
            キャンセル
          </Button>
        </div>
      )}

      {error && <span className="text-xs text-[#DC2626]">{error}</span>}
    </div>
  );
}
