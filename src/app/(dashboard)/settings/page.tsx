import { listUsers } from "@/server/repositories/users";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { redirect } from "next/navigation";

export const metadata = {
  title: "設定 | RGDシステム",
};

export default async function SettingsPage() {
  const user = await getCurrentUserProfile();

  if (!can(user?.roleCode, PERMISSIONS.SETTINGS_EDIT)) {
    redirect("/dashboard");
  }

  const users = await listUsers();
  const activeCount   = users.filter((u) => u.isActive).length;
  const inactiveCount = users.filter((u) => !u.isActive).length;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-[22px] font-semibold text-[var(--color-text)]">設定</h1>
      </div>

      {/* ユーザー管理 */}
      <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden">
        <div className="px-4 py-3 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text)]">ユーザー管理</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              有効 {activeCount}名 / 無効 {inactiveCount}名
            </p>
          </div>
        </div>

        {users.length === 0 ? (
          <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">
            ユーザーが登録されていません。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">氏名</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">メールアドレス</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">ロール</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">ステータス</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-sub)]">登録日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[var(--color-accent-tint)] transition-colors">
                    <td className="px-4 py-2.5 font-medium text-[var(--color-text)]">
                      {u.displayName}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-text-sub)]">
                      {u.email}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-text-sub)]">
                      {u.roleLabel || u.roleCode}
                    </td>
                    <td className="px-4 py-2.5">
                      {u.isActive ? (
                        <span className="text-sm text-[#16A34A] font-medium">有効</span>
                      ) : (
                        <span className="text-sm text-[var(--color-text-muted)]">無効</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                      {new Date(u.createdAt).toLocaleDateString("ja-JP", {
                        year: "numeric", month: "2-digit", day: "2-digit",
                        timeZone: "Asia/Tokyo",
                      })}
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
