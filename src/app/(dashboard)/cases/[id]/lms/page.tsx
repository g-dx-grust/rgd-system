import { notFound } from "next/navigation";
import { getCase } from "@/server/repositories/cases";
import {
  listLatestProgressSnapshots,
  listSyncLogs,
} from "@/server/repositories/lms";
import { listParticipants } from "@/server/repositories/participants";
import { classifyProgress, calcCompletionRate, PROGRESS_STATUS_LABELS } from "@/server/services/lms";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { CasePageShell } from "@/components/domain";
import { LmsSyncFormClient } from "./LmsSyncFormClient";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCase(id);
  return { title: c ? `LMS進捗 — ${c.caseName} | RGDシステム` : "LMS進捗 | RGDシステム" };
}

export default async function CaseLmsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user, caseData, participants] = await Promise.all([
    getCurrentUserProfile(),
    getCase(id),
    listParticipants(id),
  ]);

  if (!caseData) notFound();

  const canSync = can(user?.roleCode, PERMISSIONS.LMS_PROGRESS_SYNC);
  const canView = can(user?.roleCode, PERMISSIONS.LMS_PROGRESS_VIEW);

  const [snapshots, syncLogs] = canView
    ? await Promise.all([
        listLatestProgressSnapshots(id),
        listSyncLogs(id, 10),
      ])
    : [[], []];

  // 受講者 ID → 名前マップ
  const participantMap = new Map(participants.map((p) => [p.id, p]));

  const classified = classifyProgress(snapshots);
  const completionRate = calcCompletionRate(snapshots);

  const completedCount  = classified.filter((c) => c.progressStatus === "completed").length;
  const stagnantCount   = classified.filter((c) => c.progressStatus === "stagnant").length;
  const inProgressCount = classified.filter((c) => c.progressStatus === "in_progress").length;
  const notStartedCount = classified.filter((c) => c.progressStatus === "not_started").length;

  return (
    <CasePageShell
      caseId={id}
      caseCode={caseData.caseCode}
      caseName={caseData.caseName}
      caseStatus={caseData.status}
      operatingCompanyName={caseData.operatingCompanyName}
      organizationId={caseData.organizationId}
      organizationName={caseData.organizationName}
      activeTab="lms"
      sectionTitle="LMS進捗"
      sectionDescription="受講者別の学習進捗と同期履歴を確認します。"
    >
      {!canView ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            LMS進捗を閲覧する権限がありません。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左: 受講者進捗テーブル */}
        <div className="lg:col-span-2 space-y-5">

          {/* サマリーカード */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard label="完了率" value={`${completionRate}%`} />
            <SummaryCard label="完了" value={String(completedCount)} color="success" />
            <SummaryCard label="停滞" value={String(stagnantCount)} color="warning" />
            <SummaryCard label="未着手" value={String(notStartedCount)} color="muted" />
          </section>

          {/* 受講者別進捗一覧 */}
          <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
            <div className="px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                受講者別進捗
                {stagnantCount > 0 && (
                  <span className="ml-2 text-sm font-normal text-[var(--color-warning)]">
                    停滞 {stagnantCount}名
                  </span>
                )}
              </h2>
            </div>

            {classified.length === 0 ? (
              <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                同期済みの進捗データがありません。CSVを取込んでください。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">受講者</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">進捗率</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">ステータス</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">最終アクセス</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">停滞日数</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {classified.map(({ snapshot, progressStatus, stagnantDays }) => {
                      const participant = participantMap.get(snapshot.participantId);
                      return (
                        <tr
                          key={snapshot.id}
                          className="hover:bg-[var(--color-accent-tint)] transition-colors"
                        >
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-[var(--color-text)]">
                              {participant?.name ?? snapshot.lmsUserId ?? "—"}
                            </p>
                            {participant?.email && (
                              <p className="text-xs text-[var(--color-text-muted)]">
                                {participant.email}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[var(--color-accent)] rounded-full"
                                  style={{ width: `${snapshot.progressRate}%` }}
                                />
                              </div>
                              <span className="text-xs text-[var(--color-text-sub)]">
                                {snapshot.progressRate.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <ProgressStatusBadge status={progressStatus} />
                          </td>
                          <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">
                            {snapshot.lastAccessAt
                              ? formatDateTime(snapshot.lastAccessAt)
                              : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {stagnantDays != null ? (
                              <span className="text-[var(--color-warning)] font-medium">
                                {stagnantDays}日
                              </span>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 同期履歴 */}
          <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
            <div className="px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
              <h2 className="text-base font-semibold text-[var(--color-text)]">同期履歴</h2>
            </div>

            {syncLogs.length === 0 ? (
              <div className="py-6 text-center text-sm text-[var(--color-text-muted)]">
                同期履歴がありません。
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {syncLogs.map((log) => (
                  <li key={log.id} className="px-4 py-3 flex items-start justify-between gap-4 text-sm">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <SyncStatusBadge status={log.status} />
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {formatDateTime(log.startedAt)}
                        </span>
                        {log.sourceFilename && (
                          <span className="text-xs text-[var(--color-text-muted)]">
                            — {log.sourceFilename}
                          </span>
                        )}
                      </div>
                      {log.totalRecords != null && (
                        <p className="text-xs text-[var(--color-text-muted)]">
                          全{log.totalRecords}件 / 成功{log.successRecords}件 / エラー{log.errorRecords}件
                        </p>
                      )}
                      {log.errorDetail && (
                        <p className="text-xs text-[var(--color-error)] whitespace-pre-wrap line-clamp-2">
                          {log.errorDetail}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">
                      {log.adapterType.toUpperCase()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* 右: CSV取込パネル */}
        <div className="space-y-4">
          {canSync && (
            <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 space-y-3">
              <h2 className="text-base font-semibold text-[var(--color-text)]">CSV取込</h2>
              <LmsSyncFormClient caseId={id} />
            </section>
          )}

          {/* 進捗サマリー内訳 */}
          <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 space-y-2">
            <h2 className="text-base font-semibold text-[var(--color-text)] mb-3">内訳</h2>
            {[
              { label: "完了",    count: completedCount,  color: "#16A34A" },
              { label: "進行中",  count: inProgressCount, color: "var(--color-accent)" },
              { label: "停滞",    count: stagnantCount,   color: "#CA8A04" },
              { label: "未着手",  count: notStartedCount, color: "var(--color-text-muted)" },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-sub)]">{label}</span>
                <span className="font-medium" style={{ color }}>{count}名</span>
              </div>
            ))}
          </section>
        </div>
      </div>
      )}
    </CasePageShell>
  );
}

// ---------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------
function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString("ja-JP", {
    year:  "numeric",
    month: "2-digit",
    day:   "2-digit",
    hour:  "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: "success" | "warning" | "error" | "muted";
}) {
  const valueColor =
    color === "success" ? "#16A34A" :
    color === "warning" ? "#CA8A04" :
    color === "error"   ? "#DC2626" :
    color === "muted"   ? "var(--color-text-muted)" :
    "var(--color-text)";

  return (
    <div className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 text-center">
      <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
      <p className="text-2xl font-semibold" style={{ color: valueColor }}>{value}</p>
    </div>
  );
}

function ProgressStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed:   "bg-[#dcfce7] text-[#16A34A]",
    in_progress: "bg-[var(--color-accent-tint)] text-[var(--color-accent)]",
    stagnant:    "bg-[#fef9c3] text-[#CA8A04]",
    not_started: "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]",
  };
  const labels: Record<string, string> = {
    completed:   "完了",
    in_progress: "進行中",
    stagnant:    "停滞",
    not_started: "未着手",
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded-[var(--radius-sm)] font-medium ${styles[status] ?? ""}`}>
      {labels[status] ?? status}
    </span>
  );
}

function SyncStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: "bg-[#dcfce7] text-[#16A34A]",
    partial: "bg-[#fef9c3] text-[#CA8A04]",
    failed:  "bg-[#fee2e2] text-[#DC2626]",
    running: "bg-[var(--color-accent-tint)] text-[var(--color-accent)]",
  };
  const labels: Record<string, string> = {
    success: "成功",
    partial: "一部エラー",
    failed:  "失敗",
    running: "実行中",
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded-[var(--radius-sm)] font-medium ${styles[status] ?? ""}`}>
      {labels[status] ?? status}
    </span>
  );
}

// PROGRESS_STATUS_LABELS を型として使うための再エクスポート（lint 警告回避）
void PROGRESS_STATUS_LABELS;
