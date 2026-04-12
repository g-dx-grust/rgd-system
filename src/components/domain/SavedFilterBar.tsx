"use client";

/**
 * SavedFilterBar
 *
 * 保存フィルタの一覧表示・適用・保存・削除を行うクライアントコンポーネント。
 * 案件一覧フィルタの上部に配置する。
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

interface SavedFilter {
  id: string;
  name: string;
  filterParams: Record<string, unknown>;
  isDefault: boolean;
}

interface SavedFilterBarProps {
  /** フィルタのスコープ（例: "cases"） */
  scope: string;
  /** 現在のフィルタ値（保存時に使用） */
  currentParams: Record<string, unknown>;
}

export function SavedFilterBar({ scope, currentParams }: SavedFilterBarProps) {
  const router = useRouter();
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [saving, setSaving] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadFilters = useCallback(async () => {
    const res = await fetch(`/api/saved-filters?scope=${encodeURIComponent(scope)}`);
    if (res.ok) {
      const json = await res.json() as { filters: SavedFilter[] };
      setFilters(json.filters);
    }
  }, [scope]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  const handleApply = (filter: SavedFilter) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filter.filterParams)) {
      if (v !== undefined && v !== null && v !== "") {
        params.set(k, String(v));
      }
    }
    router.push(`/cases?${params.toString()}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この保存フィルタを削除しますか？")) return;
    await fetch(`/api/saved-filters/${id}`, { method: "DELETE" });
    setFilters((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSave = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/saved-filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:         newName.trim(),
          scope,
          filterParams: currentParams,
        }),
      });
      if (!res.ok) {
        setError("保存に失敗しました");
        return;
      }
      setShowInput(false);
      setNewName("");
      await loadFilters();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* 保存済みフィルタ一覧 */}
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-[var(--color-text-muted)]">保存済み:</span>
          {filters.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-0.5 border border-[var(--color-border)] rounded-[var(--radius-sm)] overflow-hidden"
            >
              <button
                type="button"
                onClick={() => handleApply(f)}
                className="px-2.5 py-1 text-xs text-[var(--color-text)] hover:bg-[var(--color-accent-tint)] transition-colors"
              >
                {f.isDefault && (
                  <span className="mr-1 text-[var(--color-accent)]">★</span>
                )}
                {f.name}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(f.id)}
                className="px-1.5 py-1 text-xs text-[var(--color-text-muted)] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors border-l border-[var(--color-border)]"
                aria-label={`${f.name}を削除`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 保存入力 */}
      {showInput ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            placeholder="フィルタ名を入力"
            maxLength={60}
            className="border border-[var(--color-border)] rounded-[var(--radius-sm)] px-2.5 py-1 text-sm text-[var(--color-text)] w-48 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            autoFocus
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving || !newName.trim()}
          >
            保存
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setShowInput(false); setNewName(""); setError(null); }}
          >
            キャンセル
          </Button>
          {error && <span className="text-xs text-[#DC2626]">{error}</span>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowInput(true)}
          className="text-xs text-[var(--color-accent)] hover:underline"
        >
          + 現在のフィルタを保存
        </button>
      )}
    </div>
  );
}
