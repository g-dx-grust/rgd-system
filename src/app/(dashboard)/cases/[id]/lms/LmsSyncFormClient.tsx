"use client";

/**
 * LMS進捗 CSV取込フォーム（Client Component）
 */

import { useActionState, useRef } from "react";
import { syncLmsProgressAction } from "@/server/usecases/lms/sync-actions";
import type { SyncActionResult } from "@/server/usecases/lms/sync-actions";

interface Props {
  caseId: string;
}

export function LmsSyncFormClient({ caseId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [state, formAction, isPending] = useActionState<SyncActionResult | null, FormData>(
    syncLmsProgressAction,
    null
  );

  return (
    <form
      action={formAction}
      className="space-y-3"
    >
      <input type="hidden" name="caseId" value={caseId} />

      <div>
        <label
          htmlFor="lms-csv-file"
          className="block text-xs font-medium text-[var(--color-text-sub)] mb-1"
        >
          CSVファイル（UTF-8 / ヘッダー行必須）
        </label>
        <input
          id="lms-csv-file"
          ref={fileRef}
          type="file"
          name="csvFile"
          accept=".csv,text/csv"
          required
          className="block w-full text-sm text-[var(--color-text)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        />
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          必須列: lms_user_id, progress_rate, is_completed, last_access_at
        </p>
      </div>

      {state?.error && (
        <p className="text-sm text-[var(--color-error)]">{state.error}</p>
      )}

      {state?.success && (
        <div className="text-sm space-y-1">
          <p className="text-[#16A34A] font-medium">
            同期完了: {state.successRecords} 件 / {state.totalRecords} 件
          </p>
          {(state.errorRecords ?? 0) > 0 && (
            <p className="text-[var(--color-warning)]">
              エラー: {state.errorRecords} 件
            </p>
          )}
          {state.errors && state.errors.length > 0 && (
            <ul className="mt-1 text-xs text-[var(--color-error)] space-y-0.5">
              {state.errors.slice(0, 5).map((e, i) => (
                <li key={i}>行{e.row}: {e.message}</li>
              ))}
              {state.errors.length > 5 && (
                <li>… 他 {state.errors.length - 5} 件</li>
              )}
            </ul>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="text-sm font-medium px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? "取込中…" : "CSVを取込む"}
      </button>
    </form>
  );
}
