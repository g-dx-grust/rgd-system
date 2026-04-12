import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui";
import { Badge } from "@/components/ui";
import {
  getDashboardKpi,
  getStalledCases,
  getOverdueDocRequirements,
  getMyDashboardData,
} from "@/server/repositories/dashboard";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { CASE_STATUS_LABELS, CASE_STATUS_VARIANT } from "@/lib/constants/case-status";

export const metadata = { title: "ダッシュボード | RGDシステム" };

export default async function DashboardPage() {
  const user = await getCurrentUserProfile();

  const [kpi, stalledCases, overdueDocs, myData] = await Promise.all([
    getDashboardKpi(),
    getStalledCases(8),
    getOverdueDocRequirements(8),
    user ? getMyDashboardData(user.id) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-[22px] font-semibold text-[var(--color-text)]">
        ダッシュボード
      </h1>

      {/* ---- KPI サマリーカード ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="進行中の案件"
          value={kpi.activeCases}
          href="/cases?view=active"
        />
        <KpiCard
          label="期限超過"
          value={kpi.overdueCases}
          href="/cases?view=overdue"
          accent={kpi.overdueCases > 0 ? "error" : undefined}
        />
        <KpiCard
          label="保留・差戻し"
          value={kpi.stuckCases}
          href="/cases?view=stuck"
          accent={kpi.stuckCases > 0 ? "warning" : undefined}
        />
        <KpiCard
          label="今月完了"
          value={kpi.completedThisMonth}
          href="/cases?status=completed"
          accent="success"
        />
      </div>

      {/* ---- 自分向けパネル（担当者がいる場合） ---- */}
      {myData && (
        <div className="grid grid-cols-3 gap-4">
          <MyStatCard label="担当アクティブ案件" value={myData.myActiveCaseCount} />
          <MyStatCard label="本日期限のタスク"   value={myData.todayTaskCount}    alert={myData.todayTaskCount > 0} />
          <MyStatCard label="期限超過タスク"     value={myData.overdueTaskCount}  alert={myData.overdueTaskCount > 0} />
        </div>
      )}

      {/* ---- 滞留案件 / 期限超過書類 ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 滞留案件 */}
        <Card>
          <CardHeader>
            <CardTitle>滞留案件（7日以上更新なし）</CardTitle>
          </CardHeader>
          {stalledCases.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] py-3">滞留案件はありません</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {stalledCases.map((c) => (
                <li key={c.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/cases/${c.id}`}
                        className="text-sm font-medium text-[var(--color-accent)] hover:underline truncate block"
                      >
                        {c.caseName}
                      </Link>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {c.organizationName}　{c.ownerName ?? "担当未設定"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={CASE_STATUS_VARIANT[c.status]}>
                        {CASE_STATUS_LABELS[c.status]}
                      </Badge>
                      <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                        {c.stalledDays}日
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {stalledCases.length >= 8 && (
            <div className="pt-3 border-t border-[var(--color-border)]">
              <Link href="/cases?view=stalled" className="text-xs text-[var(--color-accent)] hover:underline">
                すべて見る →
              </Link>
            </div>
          )}
        </Card>

        {/* 期限超過書類 */}
        <Card>
          <CardHeader>
            <CardTitle>期限超過の書類要求</CardTitle>
          </CardHeader>
          {overdueDocs.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] py-3">期限超過の書類要求はありません</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {overdueDocs.map((d) => (
                <li key={d.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/cases/${d.caseId}?tab=documents`}
                        className="text-sm font-medium text-[var(--color-accent)] hover:underline truncate block"
                      >
                        {d.caseName}
                      </Link>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {d.documentTypeName}
                      </span>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="text-xs text-[#DC2626] font-medium whitespace-nowrap">
                        {d.overdueDays}日超過
                      </span>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        期限: {formatDate(d.dueDate)}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {overdueDocs.length >= 8 && (
            <div className="pt-3 border-t border-[var(--color-border)]">
              <Link href="/documents?view=overdue" className="text-xs text-[var(--color-accent)] hover:underline">
                すべて見る →
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// -----------------------------------------------------------
// サブコンポーネント
// -----------------------------------------------------------

function KpiCard({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: number;
  href?: string;
  accent?: "error" | "warning" | "success";
}) {
  const valueColor =
    accent === "error"
      ? "text-[#DC2626]"
      : accent === "warning"
      ? "text-[#CA8A04]"
      : accent === "success"
      ? "text-[#16A34A]"
      : "text-[var(--color-text)]";

  const content = (
    <Card>
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${valueColor}`}>{value.toLocaleString()}</p>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block hover:opacity-80 transition-opacity">
        {content}
      </Link>
    );
  }
  return content;
}

function MyStatCard({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-4 py-3">
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${alert ? "text-[#DC2626]" : "text-[var(--color-text)]"}`}>
        {value}
      </p>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
