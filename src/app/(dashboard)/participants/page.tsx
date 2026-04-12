import Link from "next/link";
import { listAllParticipants } from "@/server/repositories/participants";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { LEARNER_STATUS_LABELS } from "@/lib/constants/case-status";

export const metadata = {
  title: "受講者管理 | RGDシステム",
};

export default async function ParticipantsPage() {
  const user = await getCurrentUserProfile();

  if (!can(user?.roleCode, PERMISSIONS.TRAINEE_EDIT)) {
    redirect("/dashboard");
  }

  const participants = await listAllParticipants();

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold text-[var(--color-text)]">受講者管理</h1>
        <span className="text-sm text-[var(--color-text-muted)]">
          全案件合計: {participants.length}名
        </span>
      </div>

      {/* 横断一覧 */}
      <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
        <div className="px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            受講者一覧
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            各案件の受講者詳細は案件ページから管理できます
          </p>
        </div>

        {participants.length === 0 ? (
          <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">
            受講者が登録されていません。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">氏名</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">企業</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">案件</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">部署</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">メール</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">受講状況</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {participants.map((p) => (
                  <tr key={p.id} className="hover:bg-[var(--color-accent-tint)] transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-[var(--color-text)]">{p.name}</p>
                      {p.nameKana && (
                        <p className="text-xs text-[var(--color-text-muted)]">{p.nameKana}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-text-sub)]">
                      {p.organizationName}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/cases/${p.caseId}/participants`}
                        className="text-[var(--color-accent)] hover:underline"
                      >
                        {p.caseName}
                      </Link>
                      <p className="text-xs text-[var(--color-text-muted)]">{p.caseCode}</p>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-text-sub)]">
                      {p.department ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-text-sub)]">
                      {p.email ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <LearnerStatusBadge status={p.learnerStatus} />
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/cases/${p.caseId}/participants`}
                        className="text-xs text-[var(--color-accent)] hover:underline whitespace-nowrap"
                      >
                        案件へ →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function LearnerStatusBadge({ status }: { status: string }) {
  const label = LEARNER_STATUS_LABELS[status as keyof typeof LEARNER_STATUS_LABELS] ?? status;
  const colorMap: Record<string, string> = {
    planned:    "text-[var(--color-text-muted)]",
    active:     "text-[#16A34A] font-medium",
    completed:  "text-[var(--color-accent)] font-medium",
    excluded:   "text-[var(--color-text-muted)] line-through",
  };
  return (
    <span className={`text-sm ${colorMap[status] ?? "text-[var(--color-text-sub)]"}`}>
      {label}
    </span>
  );
}
