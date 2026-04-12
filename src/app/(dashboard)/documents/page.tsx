import Link from "next/link";
import { listAttentionRequirements } from "@/server/repositories/documents";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { REQUIREMENT_STATUS_LABEL } from "@/types/documents";

export const metadata = {
  title: "書類管理 | RGDシステム",
};

export default async function DocumentsPage() {
  const user = await getCurrentUserProfile();

  if (!can(user?.roleCode, PERMISSIONS.DOCUMENT_UPLOAD)) {
    redirect("/dashboard");
  }

  const requirements = await listAttentionRequirements();

  const returnedCount = requirements.filter((r) => r.status === "returned").length;
  const pendingCount  = requirements.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold text-[var(--color-text)]">書類管理</h1>
      </div>

      {/* サマリカード */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="border border-[var(--color-border)] rounded-[var(--radius-md)] px-5 py-4">
          <p className="text-xs text-[var(--color-text-muted)]">要対応合計</p>
          <p className="text-2xl font-semibold text-[var(--color-text)] mt-1">
            {requirements.length}<span className="text-sm font-normal ml-1">件</span>
          </p>
        </div>
        <div className="border border-[var(--color-border)] rounded-[var(--radius-md)] px-5 py-4">
          <p className="text-xs text-[var(--color-text-muted)]">差戻し中</p>
          <p className="text-2xl font-semibold text-[#DC2626] mt-1">
            {returnedCount}<span className="text-sm font-normal ml-1">件</span>
          </p>
        </div>
        <div className="border border-[var(--color-border)] rounded-[var(--radius-md)] px-5 py-4">
          <p className="text-xs text-[var(--color-text-muted)]">未提出</p>
          <p className="text-2xl font-semibold text-[var(--color-text-sub)] mt-1">
            {pendingCount}<span className="text-sm font-normal ml-1">件</span>
          </p>
        </div>
      </div>

      {/* 要対応一覧 */}
      <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
        <div className="px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            要対応書類 ({requirements.length}件)
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            差戻し中・未提出の書類を全案件から表示しています
          </p>
        </div>

        {requirements.length === 0 ? (
          <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">
            要対応の書類はありません。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">書類種別</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">企業</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">案件</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">ステータス</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">期限</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {requirements.map((r) => {
                  const isOverdue = r.dueDate
                    ? new Date(r.dueDate) < new Date()
                    : false;

                  return (
                    <tr key={r.id} className="hover:bg-[var(--color-accent-tint)] transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-[var(--color-text)]">{r.documentTypeName}</p>
                        {r.participantId && (
                          <p className="text-xs text-[var(--color-text-muted)]">受講者書類</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--color-text-sub)]">
                        {r.organizationName}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/cases/${r.caseId}/documents`}
                          className="text-[var(--color-accent)] hover:underline"
                        >
                          {r.caseName}
                        </Link>
                        <p className="text-xs text-[var(--color-text-muted)]">{r.caseCode}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <RequirementStatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-2.5">
                        {r.dueDate ? (
                          <span className={`text-sm ${isOverdue ? "text-[#DC2626] font-medium" : "text-[var(--color-text-sub)]"}`}>
                            {new Date(r.dueDate).toLocaleDateString("ja-JP", {
                              month: "2-digit",
                              day:   "2-digit",
                              timeZone: "Asia/Tokyo",
                            })}
                            {isOverdue && " 超過"}
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/cases/${r.caseId}/documents`}
                          className="text-xs text-[var(--color-accent)] hover:underline whitespace-nowrap"
                        >
                          案件へ →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function RequirementStatusBadge({ status }: { status: string }) {
  const label = REQUIREMENT_STATUS_LABEL[status as keyof typeof REQUIREMENT_STATUS_LABEL] ?? status;
  if (status === "returned") {
    return <span className="text-sm text-[#DC2626] font-medium">{label}</span>;
  }
  return <span className="text-sm text-[var(--color-text-muted)]">{label}</span>;
}
