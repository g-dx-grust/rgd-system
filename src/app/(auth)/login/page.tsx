import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  return (
    <div className="flex h-full min-h-screen">
      {/* 左側: 業界イメージ (60%) */}
      <div
        className="hidden lg:flex lg:w-[60%] relative flex-col items-start justify-end"
        style={{
          background: "linear-gradient(to bottom right, #1a3a6e, #0f2040)",
        }}
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
            助成金研修の事務運用を
            <br />
            シンプルに。
          </p>
          <p className="text-sm text-white/70">
            RGDシステム — 株式会社グラスト
          </p>
        </div>
      </div>

      {/* 右側: ログインフォーム (40%) */}
      <div className="flex flex-1 lg:w-[40%] flex-col items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-[360px]">
          <h1
            className="text-[22px] font-semibold text-[var(--color-text)] mb-8"
            style={{ fontFamily: "var(--font-base)" }}
          >
            RGDシステム
          </h1>

          {reason === "no-profile" && (
            <div
              className="mb-4 text-xs text-[var(--color-text-sub)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2"
              role="alert"
            >
              アカウントのプロフィールが見つかりませんでした。
              管理者にお問い合わせください。
            </div>
          )}

          <LoginForm />

          <p className="mt-8 text-xs text-center text-[var(--color-text-muted)]">
            © {new Date().getFullYear()} 株式会社グラスト. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
