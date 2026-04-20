/**
 * 社労士専用ログイン画面
 * /external/specialist/login
 *
 * - external_specialist ロール限定
 * - 内部ユーザーの /login とは完全分離
 * - 既にログイン済みなら /external/specialist/cases へリダイレクト
 */

import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { SpecialistLoginForm } from "./SpecialistLoginForm";

export const metadata = {
  title: "社労士ポータル ログイン | RGDシステム",
};

export default async function SpecialistLoginPage() {
  const profile = await getCurrentUserProfile();
  if (profile?.roleCode === "external_specialist" && profile.isActive) {
    redirect("/external/specialist/cases");
  }

  return (
    <div className="flex h-full min-h-screen">
      {/* 左側: イメージパネル (60%) */}
      <div
        className="hidden lg:flex lg:w-[60%] relative flex-col items-start justify-end"
        style={{ background: "linear-gradient(to bottom right, #1a3a6e, #0f2040)" }}
        aria-hidden="true"
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 gap-px">
            {Array.from({ length: 64 }).map((_, i) => (
              <div key={i} className="bg-white" />
            ))}
          </div>
        </div>
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative z-10 p-10 text-white">
          <p className="text-3xl font-semibold leading-snug mb-2">
            助成金研修の申請手続きを
            <br />
            スムーズに。
          </p>
          <p className="text-sm text-white/70">
            RGDシステム 社労士ポータル — 株式会社グラスト
          </p>
        </div>
      </div>

      {/* 右側: ログインフォーム (40%) */}
      <div className="flex flex-1 lg:w-[40%] flex-col items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-[360px]">
          <h1
            className="text-[22px] font-semibold text-[var(--color-text)] mb-1"
            style={{ fontFamily: "var(--font-base)" }}
          >
            RGDシステム
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-8">
            社労士ポータル
          </p>

          <SpecialistLoginForm />

          <p className="mt-8 text-xs text-center text-[var(--color-text-muted)]">
            © {new Date().getFullYear()} 株式会社グラスト. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
