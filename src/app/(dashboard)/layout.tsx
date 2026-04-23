import { DashboardLayout } from "@/components/layout";
import { getCurrentUserProfile, getAuthUser } from "@/lib/auth/session";
import { INTERNAL_LOGIN_PATH, SPECIALIST_HOME_PATH } from "@/lib/auth/access-routes";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function Layout({ children }: { children: ReactNode }) {
  // 認証チェック（proxy.ts での楽観的チェックに加えてサーバー側でも確認）
  const profile = await getCurrentUserProfile();
  if (!profile) {
    // 認証済みだがプロフィール未作成の場合、ループを避けるため reason パラメータを付与
    const user = await getAuthUser();
    if (user) {
      redirect(`${INTERNAL_LOGIN_PATH}?reason=no-profile`);
    }
    redirect(INTERNAL_LOGIN_PATH);
  }

  if (profile.roleCode === "external_specialist") {
    redirect(SPECIALIST_HOME_PATH);
  }

  return (
    <DashboardLayout
      userDisplayName={profile.displayName}
      userRoleLabel={profile.roleLabel}
    >
      {children}
    </DashboardLayout>
  );
}
