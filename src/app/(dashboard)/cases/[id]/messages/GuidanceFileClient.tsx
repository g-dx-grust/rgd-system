"use client";

import { useActionState } from "react";
import { uploadGuidanceFileAction } from "@/server/usecases/messages/actions";

interface GuidanceFileRow {
  id: string;
  fileName: string;
  uploadedAt: string;
  signedUrl: string | null;
}

interface Props {
  caseId: string;
  files: GuidanceFileRow[];
  isFeatureAvailable: boolean;
}

export function GuidanceFileClient({
  caseId,
  files,
  isFeatureAvailable,
}: Props) {
  const [state, action, isPending] = useActionState(
    uploadGuidanceFileAction,
    null
  );

  return (
    <section className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
        <h2 className="text-base font-semibold text-[var(--color-text)]">
          ご案内書
        </h2>
      </div>

      {!isFeatureAvailable ? (
        <div className="p-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            開始案内機能のデータベース設定がまだ反映されていません。migration
            適用後に利用できます。
          </p>
        </div>
      ) : (
        <>
          {/* アップロードフォーム */}
          <div className="border-b border-[var(--color-border)] p-4">
            <form action={action} className="space-y-3">
              <input type="hidden" name="caseId" value={caseId} />

              {state?.error && (
                <p className="text-sm text-[var(--color-error)]">
                  {state.error}
                </p>
              )}
              {state?.success && (
                <p className="text-sm text-[#16A34A]">
                  ご案内書をアップロードしました。
                </p>
              )}

              <div className="flex items-center gap-3">
                <input
                  type="file"
                  name="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  required
                  className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--color-bg-secondary)] file:px-3 file:py-1 file:text-xs file:font-medium file:text-[var(--color-text-sub)] focus:border-[var(--color-accent)] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isPending}
                  className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
                >
                  {isPending ? "アップロード中..." : "アップロード"}
                </button>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                PDF・JPEG・PNG（最大100MB）
              </p>
            </form>
          </div>

          {/* アップロード済みファイル一覧 */}
          {files.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
              ご案内書はまだアップロードされていません。
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-[var(--color-text)]">
                      {f.fileName}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {new Date(f.uploadedAt).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                  {f.signedUrl && (
                    <a
                      href={f.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs text-[var(--color-accent)] hover:underline"
                    >
                      ダウンロード
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
