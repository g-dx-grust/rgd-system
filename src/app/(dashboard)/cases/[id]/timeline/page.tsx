import Link from "next/link";
import { notFound } from "next/navigation";
import { getCase } from "@/server/repositories/cases";
import { listAuditLogs } from "@/server/repositories/audit-log";
import { CaseStatusBadge, CaseTabNav } from "@/components/domain";
import { CASE_STATUS_LABELS } from "@/lib/constants/case-status";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCase(id);
  return { title: c ? `変更履歴 — ${c.caseName} | RGDシステム` : "変更履歴 | RGDシステム" };
}

/** audit_logs の action → 日本語ラベル */
const ACTION_LABELS: Record<string, string> = {
  case_create:              "案件を作成",
  case_update:              "案件情報を更新",
  case_delete:              "案件を削除",
  case_status_change:       "ステータスを変更",
  document_upload:          "書類をアップロード",
  document_view:            "書類を閲覧",
  document_replace:         "書類を差し替え",
  document_return:          "書類を差し戻し",
  document_delete:          "書類を削除",
  trainee_update:           "受講者情報を更新",
  specialist_package_create:"社労士連携パッケージを作成",
  billing_status_change:    "請求状態を変更",
  lms_progress_sync:        "LMS進捗を同期",
};

export default async function CaseTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [caseData, { logs }] = await Promise.all([
    getCase(id),
    listAuditLogs({ targetType: "case", targetId: id, perPage: 200 }),
  ]);

  if (!caseData) notFound();

  return (
    <div className="space-y-5">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <Link href="/cases" className="hover:text-[var(--color-accent)]">案件管理</Link>
        <span>/</span>
        <Link href={`/cases/${id}`} className="hover:text-[var(--color-accent)]">{caseData.caseCode}</Link>
        <span>/</span>
        <span>変更履歴</span>
      </div>

      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <h1 className="text-[22px] font-semibold text-[var(--color-text)]">{caseData.caseName}</h1>
        <CaseStatusBadge status={caseData.status} />
      </div>

      {/* タブナビ */}
      <CaseTabNav caseId={id} activeTab="timeline" />

      {/* タイムライン */}
      <div className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
        {logs.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--color-text-muted)]">
            変更履歴がありません。
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {logs.map((log) => (
              <li key={log.id} className="px-5 py-4 flex gap-4 items-start">
                {/* 時刻列 */}
                <time
                  dateTime={log.createdAt}
                  className="flex-shrink-0 text-xs text-[var(--color-text-muted)] w-36"
                >
                  {formatJst(log.createdAt)}
                </time>

                {/* 内容列 */}
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm text-[var(--color-text)]">
                    <span className="font-medium">
                      {log.userDisplayName ?? "システム"}
                    </span>
                    {" が "}
                    <span>{ACTION_LABELS[log.action] ?? log.action}</span>
                  </p>

                  {/* ステータス変更の場合は変更前後を表示 */}
                  {log.action === "case_status_change" && log.metadata && (
                    <StatusChangePill metadata={log.metadata} />
                  )}

                  {/* その他メタデータ（書類名など） */}
                  {log.metadata?.document_name != null && (
                    <p className="text-xs text-[var(--color-text-muted)]">
                      書類: {String(log.metadata.document_name)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// ステータス変更ピル（変更前 → 変更後）
// ---------------------------------------------------------------
function StatusChangePill({ metadata }: { metadata: Record<string, unknown> }) {
  const from = metadata["from"] as string | undefined;
  const to   = metadata["to"]   as string | undefined;
  if (!from && !to) return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      {from && (
        <span className="border border-[var(--color-border)] rounded-[var(--radius-sm)] px-2 py-0.5 text-[var(--color-text-muted)]">
          {CASE_STATUS_LABELS[from as keyof typeof CASE_STATUS_LABELS] ?? from}
        </span>
      )}
      {from && to && <span className="text-[var(--color-text-muted)]">→</span>}
      {to && (
        <span className="border border-[var(--color-accent)] rounded-[var(--radius-sm)] px-2 py-0.5 text-[var(--color-accent)]">
          {CASE_STATUS_LABELS[to as keyof typeof CASE_STATUS_LABELS] ?? to}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// 日時フォーマット（JST）
// ---------------------------------------------------------------
function formatJst(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year:     "numeric",
      month:    "2-digit",
      day:      "2-digit",
      hour:     "2-digit",
      minute:   "2-digit",
    });
  } catch {
    return isoStr;
  }
}
