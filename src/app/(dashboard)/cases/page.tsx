import Link from "next/link";
import { listCases } from "@/server/repositories/cases";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { CaseStatusBadge, CaseFilterBar, SavedFilterBar } from "@/components/domain";
import { ButtonLink, Badge, FormActionButton } from "@/components/ui";
import type { CaseStatus } from "@/lib/constants/case-status";
import { listOperatingCompanies } from "@/server/repositories/operating-companies";
import { deleteCaseAction } from "@/server/usecases/cases/actions";

const INACTIVE_STATUSES: CaseStatus[] = ["completed", "cancelled", "on_hold"];

const VIEW_LABELS: Record<string, string> = {
  active:  "進行中のみ",
  overdue: "期限超過",
  stalled: "停滞中",
  stuck:   "停滞中",
};
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "案件一覧 | RGDシステム" };

async function listUserOptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_profiles")
    .select("id, display_name")
    .is("deleted_at", null)
    .order("display_name", { ascending: true });
  return (data ?? []).map((u) => ({ id: String(u.id), displayName: String(u.display_name) }));
}

async function listOperatingCompanyOptions() {
  const companies = await listOperatingCompanies();
  return companies.map((company) => ({ id: company.id, name: company.name }));
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;

  const status           = (sp["status"] as CaseStatus) || undefined;
  const owner            = sp["owner"] || undefined;
  const search           = sp["search"] || undefined;
  const page             = Number(sp["page"] ?? 1);
  const view             = sp["view"] || undefined;
  const operatingCompany = sp["operatingCompany"] || undefined;

  let overdueOnly      = false;
  let stalledOnly      = false;
  let excludeStatuses: CaseStatus[] | undefined;

  if (view === "active") {
    excludeStatuses = INACTIVE_STATUSES;
  } else if (view === "overdue") {
    overdueOnly = true;
  } else if (view === "stalled" || view === "stuck") {
    stalledOnly = true;
  }

  const [user, result, users, operatingCompanies] = await Promise.all([
    getCurrentUserProfile(),
    listCases({ status, ownerUserId: owner, search, page, perPage: 20, overdueOnly, stalledOnly, excludeStatuses, operatingCompanyId: operatingCompany }),
    listUserOptions(),
    listOperatingCompanyOptions(),
  ]);

  const canCreate  = can(user?.roleCode, PERMISSIONS.CASE_CREATE);
  const canViewAll = can(user?.roleCode, PERMISSIONS.CASE_VIEW_ALL);
  const canDelete  = can(user?.roleCode, PERMISSIONS.CASE_DELETE);
  const totalPages = Math.ceil(result.total / result.perPage);

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold text-[var(--color-text)]">案件管理</h1>
        {canCreate && (
          <ButtonLink href="/cases/new" variant="primary" size="sm">
            + 案件を追加
          </ButtonLink>
        )}
      </div>

      {/* 保存済みフィルタバー */}
      <SavedFilterBar
        scope="cases"
        currentParams={{ status: status ?? "", owner: owner ?? "", search: search ?? "", operatingCompany: operatingCompany ?? "" }}
      />

      {/* フィルターバー */}
      <CaseFilterBar
        users={users}
        operatingCompanies={operatingCompanies}
        currentStatus={status ?? ""}
        currentOwner={owner ?? ""}
        currentSearch={search ?? ""}
        currentOperatingCompany={operatingCompany ?? ""}
        currentView={view}
        viewLabel={view ? VIEW_LABELS[view] : undefined}
        canViewAll={canViewAll}
      />

      {/* 件数表示 */}
      <p className="text-sm text-[var(--color-text-muted)]">
        {result.total}件
        {result.total > result.perPage && ` （${page} / ${totalPages} ページ）`}
      </p>

      {/* 一覧テーブル */}
      <div className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
        {result.cases.length === 0 ? (
          <div className="py-16 text-center text-[var(--color-text-muted)] text-sm">
            {status || owner || search || view || operatingCompany
              ? "条件に一致する案件がありません。"
              : "案件が登録されていません。"}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
              <tr>
                {["案件コード", "案件名", "企業名", "運営会社", "ステータス", "担当者", "不足書類", "未完了タスク", "次回期限"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)] whitespace-nowrap"
                    >
                      {h}
                    </th>
                  )
                )}
                {canDelete && (
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)] whitespace-nowrap">
                    操作
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {result.cases.map((c) => {
                const isOverdue  = isOverdueFn(c.preApplicationDueDate) || isOverdueFn(c.finalApplicationDueDate);

                const hasInsufficientDocs = (c.insufficientDocCount ?? 0) > 0;
                const hasOpenTasks        = (c.openTaskCount ?? 0) > 0;
                const isNextDueSoon       = isDueSoon(c.nextDueDate ?? null);

                return (
                  <tr
                    key={c.id}
                    className={[
                      "transition-colors hover:bg-[var(--color-bg-secondary)]",
                      isOverdue ? "bg-red-50" : "",
                    ].join(" ")}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-sub)]">
                      {c.caseCode}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/cases/${c.id}`}
                        className="font-medium text-[var(--color-accent)] hover:underline"
                      >
                        {c.caseName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-sub)]">
                      {c.organizationName}
                    </td>
                    <td className="px-4 py-3">
                      <OperatingCompanyBadge name={c.operatingCompanyName} />
                    </td>
                    <td className="px-4 py-3">
                      <CaseStatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-sub)]">
                      {c.ownerName ?? "—"}
                    </td>
                    <td className={["px-4 py-3 text-xs text-right tabular-nums", hasInsufficientDocs ? "text-[#DC2626] font-medium" : "text-[var(--color-text-muted)]"].join(" ")}>
                      {hasInsufficientDocs ? c.insufficientDocCount : "—"}
                    </td>
                    <td className={["px-4 py-3 text-xs text-right tabular-nums", hasOpenTasks ? "text-[var(--color-warning)] font-medium" : "text-[var(--color-text-muted)]"].join(" ")}>
                      {hasOpenTasks ? c.openTaskCount : "—"}
                    </td>
                    <td className={["px-4 py-3 text-xs", isNextDueSoon ? "text-[var(--color-warning)] font-medium" : "text-[var(--color-text-sub)]"].join(" ")}>
                      {c.nextDueDate ?? "—"}
                    </td>
                    {canDelete && (
                      <td className="px-4 py-3">
                        <FormActionButton
                          action={deleteCaseAction}
                          fields={{ caseId: c.id }}
                          label="削除"
                          pendingLabel="削除中..."
                          confirmMessage={`案件「${c.caseName}」を削除しますか？関連する受講者や進行データは一覧から見えなくなります。`}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} searchParams={sp} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// ページネーション
// ---------------------------------------------------------------
function Pagination({
  currentPage,
  totalPages,
  searchParams,
}: {
  currentPage: number;
  totalPages: number;
  searchParams: Record<string, string>;
}) {
  function makeHref(p: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(p));
    return `/cases?${params.toString()}`;
  }

  return (
    <div className="flex items-center justify-center gap-2">
      {currentPage > 1 && (
        <Link
          href={makeHref(currentPage - 1)}
          className="h-8 px-3 text-sm border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-white text-[var(--color-text-sub)] hover:bg-[var(--color-bg-secondary)] flex items-center"
        >
          ← 前へ
        </Link>
      )}
      <span className="text-sm text-[var(--color-text-muted)]">
        {currentPage} / {totalPages}
      </span>
      {currentPage < totalPages && (
        <Link
          href={makeHref(currentPage + 1)}
          className="h-8 px-3 text-sm border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-white text-[var(--color-text-sub)] hover:bg-[var(--color-bg-secondary)] flex items-center"
        >
          次へ →
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------
function isDueSoon(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const due  = new Date(dateStr);
  const now  = new Date();
  const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 7;
}

function isOverdueFn(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function OperatingCompanyBadge({ name }: { name: string }) {
  const isGrast = name.includes("グラスト");
  return (
    <Badge variant={isGrast ? "accent" : "default"}>
      {name || "—"}
    </Badge>
  );
}
