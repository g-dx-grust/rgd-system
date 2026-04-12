import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { listUsers, listRoles } from "@/server/repositories/users";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { UserRoleForm } from "./UserRoleForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ユーザー管理 | RGDシステム",
};

export default async function UsersPage() {
  const currentUser = await getCurrentUserProfile();

  // 権限チェック: Admin のみアクセス可
  if (!currentUser || !can(currentUser.roleCode, PERMISSIONS.USER_MANAGE)) {
    redirect("/dashboard");
  }

  const [users, roles] = await Promise.all([listUsers(), listRoles()]);

  // 顧客ポータル・社労士ロールは内部管理画面から除外
  const internalRoles = roles.filter(
    (r) =>
      r.code !== "client_portal_user" && r.code !== "external_specialist"
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold text-[var(--color-text)]">
          ユーザー管理
        </h1>
        <span className="text-xs text-[var(--color-text-muted)]">
          {users.length}名
        </span>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-4 py-3 w-[280px]">
                メールアドレス / 名前
              </th>
              <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-4 py-3 w-[200px]">
                ロール
              </th>
              <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-4 py-3 w-[80px]">
                状態
              </th>
              <th className="text-right text-xs font-semibold text-[var(--color-text-muted)] px-4 py-3">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-[var(--color-text)] truncate">
                    {user.displayName}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] truncate">
                    {user.email}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[var(--color-text)]">
                    {user.roleLabel}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={user.isActive ? "success" : "default"}
                  >
                    {user.isActive ? "有効" : "無効"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {user.id !== currentUser.id && user.isActive && (
                    <UserRoleForm
                      userId={user.id}
                      currentRoleCode={user.roleCode}
                      roles={internalRoles}
                    />
                  )}
                  {user.id === currentUser.id && (
                    <span className="text-xs text-[var(--color-text-muted)]">
                      （自分）
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]"
                >
                  ユーザーが登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
