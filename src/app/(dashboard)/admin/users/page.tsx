import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { listUsers, listRoles } from "@/server/repositories/users";
import { listOperatingCompanies } from "@/server/repositories/operating-companies";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { UserRoleForm } from "./UserRoleForm";
import { UserStatusButton } from "./UserStatusButton";
import { CreateUserForm } from "./CreateUserForm";
import { UserPasswordResetButton } from "./UserPasswordResetButton";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ユーザー管理 | RGDシステム",
};

function formatLastLogin(dateStr: string | null): string {
  if (!dateStr) return "未ログイン";
  return new Date(dateStr).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

export default async function UsersPage() {
  const currentUser = await getCurrentUserProfile();

  if (!currentUser || !can(currentUser.roleCode, PERMISSIONS.USER_MANAGE)) {
    redirect("/dashboard");
  }

  const [users, roles, operatingCompanies] = await Promise.all([
    listUsers(),
    listRoles(),
    listOperatingCompanies(),
  ]);

  const activeCount   = users.filter((u) => u.isActive).length;
  const inactiveCount = users.filter((u) => !u.isActive).length;
  const unmanagedCount = users.filter((u) => !u.hasProfile).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[var(--color-text)]">
            ユーザー管理
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            有効: {activeCount}名
            {inactiveCount > 0 && (
              <span className="ml-2 text-[var(--color-warning)]">
                停止中: {inactiveCount}名
              </span>
            )}
            {unmanagedCount > 0 && (
              <span className="ml-2 text-[var(--color-warning)]">
                未追加: {unmanagedCount}名
              </span>
            )}
          </p>
        </div>
        <CreateUserForm roles={roles} operatingCompanies={operatingCompanies} />
      </div>

      {unmanagedCount > 0 && (
        <Card className="p-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            Supabase Auth には存在するものの、アプリ側プロフィールが未作成のユーザーがあります。
            「追加」からロールを設定すると管理対象へ取り込めます。
          </p>
        </Card>
      )}

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
              <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-4 py-3 w-[120px]">
                所属運営会社
              </th>
              <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-4 py-3 w-[160px]">
                最終ログイン
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
                className={[
                  "border-b border-[var(--color-border)] last:border-0",
                  !user.hasProfile
                    ? "bg-yellow-50/60"
                    : user.isActive
                      ? "hover:bg-[var(--color-bg-secondary)]"
                      : "bg-[var(--color-bg-secondary)] opacity-70",
                ].join(" ")}
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
                  {user.hasProfile ? (
                    <span className="text-[var(--color-text)]">{user.roleLabel}</span>
                  ) : (
                    <Badge variant="warning">未追加</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  {user.operatingCompanyName ? (
                    <Badge variant={user.operatingCompanyName.includes("グラスト") ? "accent" : "default"}>
                      {user.operatingCompanyName}
                    </Badge>
                  ) : (
                    <span className="text-xs text-[var(--color-text-muted)]">横断可</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                  {formatLastLogin(user.lastLoginAt)}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={!user.hasProfile ? "warning" : user.isActive ? "success" : "default"}
                  >
                    {!user.hasProfile ? "要設定" : user.isActive ? "有効" : "停止中"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {user.id !== currentUser.id && (
                      <UserRoleForm
                        userId={user.id}
                        currentRoleCode={user.roleCode}
                        currentOperatingCompanyId={user.operatingCompanyId}
                        roles={roles}
                        operatingCompanies={operatingCompanies}
                      />
                    )}
                    {user.id !== currentUser.id && (
                      <UserPasswordResetButton userId={user.id} />
                    )}
                    {user.id !== currentUser.id && user.hasProfile && (
                      <UserStatusButton
                        userId={user.id}
                        isActive={user.isActive}
                      />
                    )}
                    {user.id === currentUser.id && (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        （自分）
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={6}
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
