"use client";

/**
 * 請求作成フォーム（Client Component）
 *
 * useFormState でバリデーションエラーを表示。
 */

import { useActionState } from "react";
import { createInvoiceAction } from "@/server/usecases/invoices/actions";

interface Props {
  caseId: string;
}

export function BillingFormClient({ caseId }: Props) {
  const [state, action, isPending] = useActionState(createInvoiceAction, null);

  return (
    <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-4">
      <h2 className="text-base font-semibold text-[var(--color-text)] mb-4">新規請求を作成</h2>

      <form action={action} className="space-y-4">
        <input type="hidden" name="caseId" value={caseId} />

        {state?.error && (
          <p className="text-sm text-[var(--color-error)]">{state.error}</p>
        )}
        {state?.success && (
          <p className="text-sm text-[#16A34A]">請求を作成しました。</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-sub)] mb-1">
              請求番号 <span className="text-[var(--color-error)]">*</span>
            </label>
            <input
              type="text"
              name="invoiceNumber"
              required
              placeholder="例: INV-2026-001"
              className="w-full border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-sub)] mb-1">
              金額（円）
            </label>
            <input
              type="number"
              name="amount"
              min={0}
              placeholder="例: 100000"
              className="w-full border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-sub)] mb-1">
              請求日
            </label>
            <input
              type="date"
              name="invoiceDate"
              className="w-full border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-sub)] mb-1">
              支払期限
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
            {isPending ? "作成中..." : "請求を作成"}
          </button>
        </div>
      </form>
    </section>
  );
}
