"use client";

import { useActionState, useRef } from "react";
import { uploadInvoiceFileAction } from "@/server/usecases/invoices/actions";

interface Props {
  caseId: string;
  isFeatureAvailable: boolean;
}

export function InvoiceUploadClient({ caseId, isFeatureAvailable }: Props) {
  const [state, action, isPending] = useActionState(
    uploadInvoiceFileAction,
    null
  );
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
      <h2 className="mb-4 text-base font-semibold text-[var(--color-text)]">
        請求書をアップロード
      </h2>

      {!isFeatureAvailable ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          請求書ファイル機能のデータベース設定がまだ反映されていません。migration
          適用後に利用できます。
        </p>
      ) : (
        <form action={action} className="space-y-4">
          <input type="hidden" name="caseId" value={caseId} />

          {state?.error && (
            <p className="text-sm text-[var(--color-error)]">{state.error}</p>
          )}
          {state?.success && (
            <p className="text-sm text-[#16A34A]">
              請求書をアップロードしました。
            </p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-sub)]">
              ファイル <span className="text-[var(--color-error)]">*</span>
              <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">
                PDF・JPEG・PNG（最大100MB）
              </span>
            </label>
            <input
              ref={fileRef}
              type="file"
              name="file"
              accept=".pdf,.jpg,.jpeg,.png"
              required
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--color-bg-secondary)] file:px-3 file:py-1 file:text-xs file:font-medium file:text-[var(--color-text-sub)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {isPending ? "アップロード中..." : "アップロード"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
