import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrganization, listContacts } from "@/server/repositories/organizations";
import { listCases } from "@/server/repositories/cases";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { CaseStatusBadge } from "@/components/domain";
import { ButtonLink } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await getOrganization(id);
  return { title: org ? `${org.legalName} | RGDシステム` : "企業詳細 | RGDシステム" };
}

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user, org, contacts, casesResult] = await Promise.all([
    getCurrentUserProfile(),
    getOrganization(id),
    listContacts(id),
    listCases({ organizationId: id, perPage: 50 }),
  ]);

  if (!org) notFound();

  const canEdit = can(user?.roleCode, PERMISSIONS.CLIENT_EDIT);

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-1">
            <Link href="/organizations" className="hover:text-[var(--color-accent)]">
              企業管理
            </Link>
            <span>/</span>
            <span>{org.legalName}</span>
          </div>
          <h1 className="text-[22px] font-semibold text-[var(--color-text)]">{org.legalName}</h1>
        </div>
        {canEdit && (
          <ButtonLink href={`/organizations/${id}/edit`} variant="secondary" size="sm">
            編集
          </ButtonLink>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 企業情報 */}
        <div className="lg:col-span-1 space-y-5">
          <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 space-y-4">
            <h2 className="text-base font-semibold text-[var(--color-text)]">企業情報</h2>
            <dl className="space-y-3 text-sm">
              <InfoRow label="法人番号"  value={org.corporateNumber} />
              <InfoRow label="住所"      value={org.address} />
              <InfoRow label="郵便番号"  value={org.postalCode} />
              <InfoRow label="業種"      value={org.industry} />
              <InfoRow label="従業員規模" value={org.employeeSize} />
            </dl>
            {org.notes && (
              <div className="pt-2 border-t border-[var(--color-border)]">
                <p className="text-xs font-semibold text-[var(--color-text-sub)] mb-1">備考</p>
                <p className="text-sm text-[var(--color-text-sub)] whitespace-pre-wrap">{org.notes}</p>
              </div>
            )}
          </section>

          {/* 担当者 */}
          <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--color-text)]">顧客担当者</h2>
              {canEdit && (
                <Link
                  href={`/organizations/${id}/contacts/new`}
                  className="text-xs text-[var(--color-accent)] hover:underline"
                >
                  + 追加
                </Link>
              )}
            </div>
            {contacts.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">担当者が未登録です。</p>
            ) : (
              <ul className="space-y-3">
                {contacts.map((c) => (
                  <li
                    key={c.id}
                    className="text-sm border-t border-[var(--color-border)] pt-3 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--color-text)]">{c.name}</span>
                      {c.isPrimary && (
                        <span className="text-[10px] bg-[var(--color-accent-tint)] text-[var(--color-accent)] px-1.5 py-0.5 rounded-[var(--radius-sm)]">
                          主担当
                        </span>
                      )}
                    </div>
                    {c.title && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        {c.department ? `${c.department} / ` : ""}{c.title}
                      </p>
                    )}
                    {c.email && (
                      <p className="text-xs text-[var(--color-text-sub)] mt-0.5">{c.email}</p>
                    )}
                    {c.phone && (
                      <p className="text-xs text-[var(--color-text-sub)]">{c.phone}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* 案件一覧 */}
        <div className="lg:col-span-2">
          <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                関連案件
                <span className="ml-2 text-sm font-normal text-[var(--color-text-muted)]">
                  {casesResult.total}件
                </span>
              </h2>
              <ButtonLink href={`/cases/new?organizationId=${id}`} variant="secondary" size="sm">
                案件を追加
              </ButtonLink>
            </div>

            {casesResult.cases.length === 0 ? (
              <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">
                案件がありません。
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--color-border)]">
                  <tr>
                    {["案件コード", "案件名", "ステータス", "開始予定日"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {casesResult.cases.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-[var(--color-bg-secondary)] transition-colors"
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
                      <td className="px-4 py-3">
                        <CaseStatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-sub)]">
                        {c.plannedStartDate ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 flex-shrink-0 text-[var(--color-text-muted)]">{label}</dt>
      <dd className="text-[var(--color-text)]">{value ?? "—"}</dd>
    </div>
  );
}
