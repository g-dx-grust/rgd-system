"use client";

/**
 * 受理日登録フォーム（Client Component）
 *
 * 受理日を登録し、受理後タスクを自動生成する。
 * 初回登録時のみタスクが生成される（二重生成防止）。
 */

import { useActionState } from "react";
import { registerAcceptanceDateAction } from "@/server/usecases/cases/acceptance-actions";

interface Props {
  caseId:               string;
  currentAcceptanceDate: string | null;
}

export function AcceptanceDateFormClient({ caseId, currentAcceptanceDate }: Props) {
  const [state, action, isPending] = useActionState(registerAcceptanceDateAction, null);
  const isFirstRegistration = !currentAcceptanceDate;

  return (
    <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 space-y-3">
      <h2 className="text-base font-semibold text-[var(--color-text)]">受理日</h2>

      {currentAcceptanceDate ? (
        <p className="text-sm font-medium text-[var(--color-text)]">
          {currentAcceptanceDate}
          <span className="ml-2 text-xs text-[#16A34A]">登録済み</span>
        </p>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">未登録</p>
      )}

      <form action={action} className="space-y-2">
        <input type="hidden" name="caseId" value={caseId} />

        {state?.error && (
          <p className="text-xs text-[var(--color-error)]">{state.error}</p>
        )}
        {state?.success && (
          <p className="text-xs text-[#16A34A]">
            受理日を登録しました。
            {isFirstRegistration && "受理後タスクが自動生成されました。"}
          </p>
        )}

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-sub)] mb-1">
            {currentAcceptanceDate ? "受理日を変更" : "受理日を登録"}
          </label>
          <input
            type="date"
            name="acceptanceDate"
            defaultValue={currentAcceptanceDate ?? ""}
            required
            className="w-full border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>

        {isFirstRegistration && (
          <p className="text-xs text-[var(--color-text-muted)]">
            登録後、受理後タスクが自動生成されます。
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full px-3 py-1.5 text-sm font-medium text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] rounded-[var(--radius-sm)] disabled:opacity-50 transition-colors"
        >
          {isPending ? "登録中..." : currentAcceptanceDate ? "更新する" : "受理日を登録"}
        </button>
      </form>
    </section>
  );
}
