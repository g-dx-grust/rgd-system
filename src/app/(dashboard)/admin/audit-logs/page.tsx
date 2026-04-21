import { getCurrentUserProfile } from "@/lib/auth/session";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import { listAuditLogs } from "@/server/repositories/audit-log";
import type { AuditAction } from "@/server/repositories/audit-log";
import { Card } from "@/components/ui";
import { AuditLogTable } from "./AuditLogTable";

export const metadata = { title: "監査ログ | RGDシステム" };

const ACTION_LABELS: Record<string, string> = {
  login:                      "ログイン",
  logout:                     "ログアウト",
  login_failed:               "ログイン失敗",
  password_reset_request:     "パスワードリセット要求",
  password_reset_complete:    "パスワードリセット完了",
  case_create:                "案件作成",
  case_update:                "案件更新",
  case_delete:                "案件削除",
  case_status_change:         "ステータス変更",
  document_upload:            "書類アップロード",
  document_replace:           "書類差替",
  document_return:            "書類差戻し",
  document_delete:            "書類削除",
  trainee_update:             "受講者情報変更",
  specialist_package_create:  "社労士連携パッケージ作成",
  billing_status_change:      "請求状態変更",
  settings_change:            "設定変更",
  user_create:                "ユーザー作成",
  user_role_change:           "権限変更",
  user_password_reset:        "パスワード再設定",
  user_activate:              "ユーザー有効化",
  user_deactivate:            "ユーザー無効化",
  lms_progress_sync:          "LMS進捗同期",
  bulk_owner_change:          "一括担当者変更",
  bulk_document_return:       "一括書類差戻し",
  course_create:              "コース作成",
  course_update:              "コース更新",
  course_activate:            "コース有効化",
  course_deactivate:          "コース無効化",
  course_delete:              "コース削除",
  subsidy_program_create:     "助成金種別作成",
  subsidy_program_delete:     "助成金種別削除",
  organization_delete:        "企業削除",
  task_delete:                "タスク削除",
  account_sheet_issue:        "アカウント発行シート出力",
  specialist_submission_record: "社労士提出記録",
  specialist_final_complete:  "社労士最終申請完了",
  deficiency_create:          "不備依頼作成",
  deficiency_status_update:   "不備依頼ステータス更新",
  specialist_comment_create:  "社労士コメント作成",
};

const FILTER_ACTIONS: AuditAction[] = [
  "case_create", "case_update", "case_delete", "case_status_change",
  "document_upload", "document_return", "document_delete",
  "task_delete", "organization_delete", "course_delete", "subsidy_program_delete",
  "user_create", "user_role_change", "user_password_reset",
  "login", "login_failed", "bulk_owner_change",
];

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const [user, sp] = await Promise.all([
    getCurrentUserProfile(),
    searchParams,
  ]);

  requirePermission(user?.roleCode, PERMISSIONS.AUDIT_LOG_VIEW);

  const action   = (sp["action"]   as AuditAction) || undefined;
  const dateFrom = sp["dateFrom"] || undefined;
  const dateTo   = sp["dateTo"]   || undefined;
  const page     = Number(sp["page"] ?? 1);

  const result = await listAuditLogs({ action, dateFrom, dateTo, page, perPage: 50 });
  const totalPages = Math.ceil(result.total / result.perPage);

  return (
    <div className="space-y-5">
      <h1 className="text-[22px] font-semibold text-[var(--color-text)]">監査ログ</h1>

      {/* フィルタ */}
      <form method="GET" className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1">操作種別</label>
          <select
            name="action"
            defaultValue={action ?? ""}
            className="border border-[var(--color-border)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm text-[var(--color-text)] bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          >
            <option value="">すべて</option>
            {FILTER_ACTIONS.map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1">開始日</label>
          <input
            type="date"
            name="dateFrom"
            defaultValue={dateFrom ?? ""}
            className="border border-[var(--color-border)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1">終了日</label>
          <input
            type="date"
            name="dateTo"
            defaultValue={dateTo ?? ""}
            className="border border-[var(--color-border)] rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-1.5 text-sm font-medium bg-[var(--color-accent)] text-white rounded-[var(--radius-sm)] hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          絞り込む
        </button>
        {(action || dateFrom || dateTo) && (
          <a
            href="/admin/audit-logs"
            className="px-4 py-1.5 text-sm text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-[var(--radius-sm)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            クリア
          </a>
        )}
      </form>

      {/* テーブル */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-muted)]">
            {result.total.toLocaleString()} 件
          </span>
        </div>
        <AuditLogTable
          logs={result.logs}
          actionLabels={ACTION_LABELS}
          totalPages={totalPages}
          currentPage={page}
          action={action ?? ""}
          dateFrom={dateFrom ?? ""}
          dateTo={dateTo ?? ""}
        />
      </Card>
    </div>
  );
}
