import Link from "next/link";
import { listCasesLmsProgressSummary } from "@/server/repositories/lms";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { redirect } from "next/navigation";

export const metadata = {
  title: "LMS進捗管理 | RGDシステム",
};

export default async function LmsDashboardPage() {
  const user = await getCurrentUserProfile();

  if (!can(user?.roleCode, PERMISSIONS.LMS_PROGRESS_VIEW)) {
    redirect("/dashboard");
  }

  const summaries = await listCasesLmsProgressSummary();

  const totalStagnant = summaries.reduce((acc, s) => acc + s.stagnantCount, 0);

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold text-[var(--color-text)]">LMS進捗管理</h1>
        {totalStagnant > 0 && (
          <span className="text-sm text-[var(--color-warning)] font-medium">
            停滞受講者あり: 計{totalStagnant}名
          </span>
        )}
      </div>

      {/* 横断一覧 */}
      <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
        <div className="px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            受講進行中案件 ({summaries.length}件)
          </h2>
        </div>

        {summaries.length === 0 ? (
          <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">
            受講進行中の案件がありません。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">案件</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">顧客企業</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-[var(--color-text-sub)]">受講者</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-[var(--color-text-sub)]">完了</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-[var(--color-text-sub)]">停滞</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">完了率</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">最終同期</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {summaries.map((s) => {
                  const rate =
                    s.totalParticipants > 0
                      ? Math.round((s.completedCount / s.totalParticipants) * 100)
                      : 0;

                  return (
                    <tr
                      key={s.caseId}
                      className="hover:bg-[var(--color-accent-tint)] transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/cases/${s.caseId}`}
                          className="font-medium text-[var(--color-text)] hover:text-[var(--color-accent)]"
                        >
                          {s.caseName}
                        </Link>
                        <p className="text-xs text-[var(--color-text-muted)]">{s.caseCode}</p>
                      </td>
                      <td className="px-4 py-2.5 text-[var(--color-text-sub)]">
                        {s.organizationName}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[var(--color-text-sub)]">
                        {s.totalParticipants}名
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-[#16A34A]">
                        {s.completedCount}名
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {s.stagnantCount > 0 ? (
                          <span className="font-medium text-[var(--color-warning)]">
                            {s.stagnantCount}名
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--color-accent)] rounded-full"
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <span className="text-xs text-[var(--color-text-sub)]">{rate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[var(--color-text-muted)]">
                        {s.lastSyncedAt
                          ? new Date(s.lastSyncedAt).toLocaleDateString("ja-JP", {
                              month: "2-digit",
                              day:   "2-digit",
                              hour:  "2-digit",
                              minute: "2-digit",
                              timeZone: "Asia/Tokyo",
                            })
                          : "未同期"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/cases/${s.caseId}/lms`}
                          className="text-xs text-[var(--color-accent)] hover:underline whitespace-nowrap"
                        >
                          詳細 →
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
