import Link from "next/link";
import { listOrganizations } from "@/server/repositories/organizations";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { ButtonLink, FormActionButton } from "@/components/ui";
import { deleteOrganizationAction } from "@/server/usecases/organizations/actions";

export const metadata = { title: "企業一覧 | RGDシステム" };

export default async function OrganizationsPage() {
  const [user, organizations] = await Promise.all([
    getCurrentUserProfile(),
    listOrganizations(),
  ]);

  const canEdit = can(user?.roleCode, PERMISSIONS.CLIENT_EDIT);

  return (
    <div className="space-y-5">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold text-[var(--color-text)]">企業管理</h1>
        {canEdit && (
          <ButtonLink href="/organizations/new" variant="primary" size="sm">
            + 企業を追加
          </ButtonLink>
        )}
      </div>

      {/* 企業一覧テーブル */}
      <div className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
        {organizations.length === 0 ? (
          <div className="py-16 text-center text-[var(--color-text-muted)] text-sm">
            企業が登録されていません。
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                  法人名
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                  法人番号
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                  業種
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                  規模
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                  住所
                </th>
                <th className="w-8" />
                {canEdit && (
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-sub)]">
                    操作
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {organizations.map((org) => (
                <tr
                  key={org.id}
                  className="hover:bg-[var(--color-bg-secondary)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/organizations/${org.id}`}
                      className="font-medium text-[var(--color-accent)] hover:underline"
                    >
                      {org.legalName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-sub)]">
                    {org.corporateNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-sub)]">
                    {org.industry ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-sub)]">
                    {org.employeeSize ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-sub)] truncate max-w-[200px]">
                    {org.address ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/organizations/${org.id}`}
                      className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
                    >
                      詳細 →
                    </Link>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <FormActionButton
                        action={deleteOrganizationAction}
                        fields={{ organizationId: org.id }}
                        label="削除"
                        pendingLabel="削除中..."
                        confirmMessage={`企業「${org.legalName}」を削除しますか？`}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
