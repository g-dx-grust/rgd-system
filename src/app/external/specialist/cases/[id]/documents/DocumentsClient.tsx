"use client";

/**
 * 社労士専用 — 書類DL・提出操作クライアントコンポーネント
 */

import { useActionState, useRef, useState } from "react";
import {
  recordSubmissionAction,
  markFinalCompleteAction,
} from "@/server/usecases/specialist/actions";
import type {
  SpecialistDocumentRow,
  SpecialistParticipantRow,
} from "@/server/repositories/specialist";

interface Props {
  caseId: string;
  documents: SpecialistDocumentRow[];
  participants: SpecialistParticipantRow[];
  submittedAt: string | null;
  submissionMethod: string | null;
  finalCompletedAt: string | null;
}

const SUBMISSION_METHODS = ["郵送", "窓口持参", "電子申請"] as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

// ---------------------------------------------------------------
// 書類DLボタン
// ---------------------------------------------------------------

function DocumentDownloadButton({
  caseId,
  doc,
}: {
  caseId: string;
  doc: SpecialistDocumentRow;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/specialist/cases/${caseId}/documents/${doc.id}/signed-url`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "URLの取得に失敗しました");
      }
      const { signedUrl } = await res.json() as { signedUrl: string };
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleDownload}
        disabled={loading}
        className="text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50 font-medium"
      >
        {loading ? "取得中..." : "DL"}
      </button>
      {error && (
        <p className="text-xs text-[#DC2626] mt-0.5">{error}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// 書類一覧セクション
// ---------------------------------------------------------------

function DocumentsSection({
  caseId,
  documents,
}: {
  caseId: string;
  documents: SpecialistDocumentRow[];
}) {
  return (
    <section className="bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <h2 className="text-base font-semibold text-[var(--color-text)]">
          提出書類
        </h2>
      </div>

      {documents.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-[var(--color-text-muted)]">
          現在、書類は登録されていません。
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-5 py-2.5">
                書類種別
              </th>
              <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-4 py-2.5">
                ファイル名
              </th>
              <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-4 py-2.5">
                受講者
              </th>
              <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-4 py-2.5">
                サイズ
              </th>
              <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-4 py-2.5">
                アップロード日
              </th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr
                key={doc.id}
                className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <td className="px-5 py-3 text-[var(--color-text)]">
                  {doc.documentTypeName}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-sub)] text-xs max-w-[200px] truncate">
                  {doc.originalFilename}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs">
                  {doc.participantName ?? "—"}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs">
                  {formatBytes(doc.fileSize)}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs">
                  {formatDate(doc.uploadedAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <DocumentDownloadButton caseId={caseId} doc={doc} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ---------------------------------------------------------------
// 受講者一覧セクション
// ---------------------------------------------------------------

function ParticipantsSection({
  participants,
}: {
  participants: SpecialistParticipantRow[];
}) {
  const [open, setOpen] = useState(false);

  if (participants.length === 0) return null;

  return (
    <section className="bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
      >
        <h2 className="text-base font-semibold text-[var(--color-text)]">
          受講者一覧（{participants.length}名）
        </h2>
        <span className="text-xs text-[var(--color-text-muted)]">
          {open ? "閉じる ▲" : "開く ▼"}
        </span>
      </button>

      {open && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              {["氏名", "フリガナ", "メール", "部署", "雇用形態", "入社日", "受講状況"].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-4 py-2.5"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => (
              <tr
                key={p.id}
                className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <td className="px-4 py-3 text-[var(--color-text)] font-medium">{p.name}</td>
                <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs">{p.nameKana ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--color-text-sub)] text-xs">{p.email ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs">{p.department ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs">{p.employmentType ?? "—"}</td>
                <td className="px-4 py-3 text-[var(--color-text-muted)] text-xs">{p.joinedAt ?? "—"}</td>
                <td className="px-4 py-3 text-xs">
                  <span className="inline-block px-2 py-0.5 border border-[var(--color-border-strong)] rounded-[var(--radius-sm)] text-[var(--color-text-sub)]">
                    {p.learnerStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ---------------------------------------------------------------
// 提出完了記録フォーム
// ---------------------------------------------------------------

function SubmissionForm({
  caseId,
  submittedAt,
  submissionMethod,
}: {
  caseId: string;
  submittedAt: string | null;
  submissionMethod: string | null;
}) {
  const [state, formAction, isPending] = useActionState(
    recordSubmissionAction,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);

  const alreadySubmitted = !!submittedAt;

  return (
    <section className="bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
      <h2 className="text-base font-semibold text-[var(--color-text)] mb-4">
        労働局への提出完了記録
      </h2>

      {alreadySubmitted ? (
        <div className="space-y-1 text-sm">
          <p className="text-[var(--color-text-sub)]">
            <span className="font-medium">提出日時:</span>{" "}
            {formatDate(submittedAt)}
          </p>
          <p className="text-[var(--color-text-sub)]">
            <span className="font-medium">提出方法:</span>{" "}
            {submissionMethod ?? "—"}
          </p>
          <p className="mt-3 text-xs text-[var(--color-text-muted)]">
            ※ 提出済みです。再記録する場合は以下から上書きできます。
          </p>
        </div>
      ) : null}

      <form
        ref={formRef}
        action={formAction}
        className="mt-4 space-y-4"
      >
        <input type="hidden" name="caseId" value={caseId} />

        <div>
          <label
            htmlFor="submittedAt"
            className="block text-sm font-medium text-[var(--color-text-sub)] mb-1"
          >
            提出日時 <span className="text-[#DC2626]">*</span>
          </label>
          <input
            id="submittedAt"
            type="datetime-local"
            name="submittedAt"
            required
            disabled={isPending}
            className="h-9 px-3 text-sm border border-[var(--color-border-strong)] rounded-[var(--radius-sm)] bg-white text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] disabled:bg-[var(--color-bg-secondary)]"
          />
        </div>

        <div>
          <label
            htmlFor="submissionMethod"
            className="block text-sm font-medium text-[var(--color-text-sub)] mb-1"
          >
            提出方法 <span className="text-[#DC2626]">*</span>
          </label>
          <select
            id="submissionMethod"
            name="submissionMethod"
            required
            disabled={isPending}
            defaultValue=""
            className="h-9 px-3 text-sm border border-[var(--color-border-strong)] rounded-[var(--radius-sm)] bg-white text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] disabled:bg-[var(--color-bg-secondary)]"
          >
            <option value="" disabled>選択してください</option>
            {SUBMISSION_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {state?.error && (
          <p className="text-xs text-[#DC2626] bg-red-50 border border-red-200 rounded-[var(--radius-sm)] px-3 py-2" role="alert">
            {state.error}
          </p>
        )}
        {state?.success && (
          <p className="text-xs text-[#16A34A] bg-green-50 border border-green-200 rounded-[var(--radius-sm)] px-3 py-2" role="status">
            提出記録を保存しました。
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="h-9 px-4 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium rounded-[var(--radius-sm)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? "保存中..." : "提出完了を記録する"}
        </button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------
// 最終申請完了マーク
// ---------------------------------------------------------------

function FinalCompleteSection({
  caseId,
  finalCompletedAt,
}: {
  caseId: string;
  finalCompletedAt: string | null;
}) {
  const [state, formAction, isPending] = useActionState(
    markFinalCompleteAction,
    null
  );
  const [confirmed, setConfirmed] = useState(false);

  if (finalCompletedAt) {
    return (
      <section className="bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
        <h2 className="text-base font-semibold text-[var(--color-text)] mb-3">
          最終申請完了
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#16A34A]">✓ 最終申請完了済み</span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {formatDate(finalCompletedAt)}
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] p-5">
      <h2 className="text-base font-semibold text-[var(--color-text)] mb-3">
        最終申請完了
      </h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        労働局への最終申請がすべて完了したら、完了マークをつけてください。
      </p>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="caseId" value={caseId} />

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm text-[var(--color-text-sub)]">
            最終申請の手続きがすべて完了したことを確認しました。
          </span>
        </label>

        {state?.error && (
          <p className="text-xs text-[#DC2626] bg-red-50 border border-red-200 rounded-[var(--radius-sm)] px-3 py-2" role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending || !confirmed}
          className="h-9 px-4 bg-[#16A34A] hover:bg-[#15803d] text-white text-sm font-medium rounded-[var(--radius-sm)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "処理中..." : "最終申請完了としてマークする"}
        </button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------
// メインエクスポート
// ---------------------------------------------------------------

export function DocumentsClient({
  caseId,
  documents,
  participants,
  submittedAt,
  submissionMethod,
  finalCompletedAt,
}: Props) {
  return (
    <div className="space-y-5">
      <DocumentsSection caseId={caseId} documents={documents} />
      <ParticipantsSection participants={participants} />
      <SubmissionForm
        caseId={caseId}
        submittedAt={submittedAt}
        submissionMethod={submissionMethod}
      />
      <FinalCompleteSection caseId={caseId} finalCompletedAt={finalCompletedAt} />
    </div>
  );
}
