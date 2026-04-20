/**
 * 社労士専用 — 担当案件一覧
 * /external/specialist/cases
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { listSpecialistCases } from "@/server/repositories/specialist";

export const metadata = {
  title: "担当案件一覧 | RGDシステム 社労士ポータル",
};

const STATUS_LABEL: Record<string, string> = {
  case_received:               "案件受領",
  initial_guide_pending:       "初期案内準備中",
  doc_collecting:              "書類回収中",
  pre_application_ready:       "初回申請準備完了",
  pre_application_shared:      "初回申請連携済み",
  labor_office_waiting:        "労働局受理待ち",
  post_acceptance_processing:  "受理後対応中",
  training_in_progress:        "受講進行中",
  completion_preparing:        "終了申請準備中",
  final_reviewing:             "視聴ログ最終確認中",
  final_application_shared:    "最終申請連携済み",
  completed:                   "完了",
  on_hold:                     "保留",
  returned:                    "差戻し",
  cancelled:                   "キャンセル",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

export default async function SpecialistCasesPage() {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.roleCode !== "external_specialist") {
    redirect("/external/specialist/login");
  }

  const cases = await listSpecialistCases(profile.id);

  return (
    <div className="space-y-5">
      <h1 className="text-[22px] font-semibold text-[var(--color-text)]">
        担当案件一覧
      </h1>

      {cases.length === 0 ? (
        <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] px-6 py-10 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            現在、担当案件はありません。
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-4 py-3">
                  案件番号 / 名称
                </th>
                <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-4 py-3">
                  企業名
                </th>
                <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-4 py-3">
                  ステータス
                </th>
                <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-4 py-3">
                  最終申請期限
                </th>
                <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-4 py-3">
                  提出状況
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {cases.map((c, idx) => (
                <tr
                  key={c.caseId}
                  className={`border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-bg-secondary)] transition-colors ${idx % 2 === 1 ? "bg-[#FAFAFA]" : ""}`}
                >
                  <td className="px-4 py-3">
                    <p className="text-xs text-[var(--color-text-muted)]">{c.caseCode}</p>
                    <p className="font-medium text-[var(--color-text)] mt-0.5">{c.caseName}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {c.operatingCompanyName}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text)]">
                    {c.organizationName}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block text-xs px-2 py-0.5 border rounded-[var(--radius-sm)] text-[var(--color-text-sub)] border-[var(--color-border-strong)]"
                    >
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-sub)]">
                    {formatDate(c.finalApplicationDueDate)}
                  </td>
                  <td className="px-4 py-3">
                    {c.finalCompletedAt ? (
                      <span className="text-xs text-[#16A34A] font-medium">最終申請完了</span>
                    ) : c.submittedAt ? (
                      <span className="text-xs text-[var(--color-text-sub)]">
                        提出済 {formatDate(c.submittedAt)}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-text-muted)]">未提出</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/external/specialist/cases/${c.caseId}/documents`}
                      className="text-xs text-[var(--color-accent)] hover:underline font-medium"
                    >
                      書類・提出 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
