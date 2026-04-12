"use client";

/**
 * 証憑登録フォーム（Client Component）
 */

import { useActionState } from "react";
import { createEvidenceItemAction } from "@/server/usecases/evidence/actions";

const EVIDENCE_TYPE_OPTIONS = [
  { value: "receipt",    label: "領収書・振込明細" },
  { value: "payslip",    label: "給与明細" },
  { value: "attendance", label: "出勤記録・タイムカード" },
  { value: "completion", label: "修了証" },
  { value: "other",      label: "その他" },
];

interface Props {
  caseId:       string;
  participants: { id: string; name: string }[];
}

export function EvidenceFormClient({ caseId, participants }: Props) {
  const [state, action, isPending] = useActionState(createEvidenceItemAction, null);

  return (
    <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
      <h2 className="text-base font-semibold text-[var(--color-text)] mb-4">証憑を追加</h2>

      <form action={action} className="space-y-4">
        <input type="hidden" name="caseId" value={caseId} />

        {state?.error && (
          <p className="text-sm text-[var(--color-error)]">{state.error}</p>
        )}
        {state?.success && (
          <p className="text-sm text-[#16A34A]">証憑を登録しました。</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-sub)] mb-1">
              証憑名 <span className="text-[var(--color-error)]">*</span>
            </label>
            <input
              type="text"
              name="title"
              required
              placeholder="例: 訓練期間中の給与明細"
              className="w-full border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-sub)] mb-1">
              種別 <span className="text-[var(--color-error)]">*</span>
            </label>
            <select
              name="evidenceType"
              defaultValue="other"
              className="w-full border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
            >
              {EVIDENCE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {participants.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-sub)] mb-1">
                対象受講者（任意）
              </label>
              <select
                name="participantId"
                className="w-full border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
              >
                <option value="">案件全体（受講者指定なし）</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-sub)] mb-1">
              回収期限
            </label>
            <input
              type="date"
              name="dueDate"
              className="w-full border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-sub)] mb-1">
            備考
          </label>
          <textarea
            name="note"
            rows={2}
            className="w-full border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)] resize-none"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] rounded-[var(--radius-sm)] disabled:opacity-50 transition-colors"
          >
            {isPending ? "登録中..." : "証憑を追加"}
          </button>
        </div>
      </form>
    </section>
  );
}
