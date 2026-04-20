/**
 * 社労士専用ポータル レイアウト
 *
 * - external_specialist ロールのみアクセス可
 * - 未認証または不正ロール → /external/specialist/login へリダイレクト
 * - 内部ダッシュボードと完全分離
 */

import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { SpecialistLogoutButton } from "./SpecialistLogoutButton";

export default async function SpecialistLayout({ children }: { children: ReactNode }) {
  const profile = await getCurrentUserProfile();

  if (!profile || profile.roleCode !== "external_specialist" || !profile.isActive) {
    redirect("/external/specialist/login");
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)]">
      {/* ヘッダー */}
      <header
        className="sticky top-0 z-30 bg-white border-b border-[var(--color-border)] h-14 flex items-center px-6"
        style={{ fontFamily: "var(--font-base)" }}
      >
        <a
          href="/external/specialist/cases"
          className="text-base font-semibold text-[var(--color-text)] hover:opacity-80 transition-opacity"
        >
          RGDシステム
        </a>
        <span className="ml-2 text-xs text-[var(--color-text-muted)]">社労士ポータル</span>

        <div className="ml-auto flex items-center gap-4">
          <span className="text-xs text-[var(--color-text-muted)]">
            {profile.displayName}
          </span>
          <SpecialistLogoutButton />
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
