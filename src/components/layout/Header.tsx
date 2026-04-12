"use client";

import { type HTMLAttributes } from "react";
import { logoutAction } from "@/server/usecases/auth/actions";

interface HeaderProps extends HTMLAttributes<HTMLElement> {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  userDisplayName?: string;
  userRoleLabel?: string;
}

export function Header({
  onToggleSidebar,
  isSidebarOpen,
  userDisplayName,
  userRoleLabel,
  className = "",
  ...props
}: HeaderProps) {
  return (
    <header
      className={[
        "sticky top-0 z-40",
        "h-14 min-h-14",
        "bg-white",
        "border-b border-[var(--color-border)]",
        "flex items-center gap-3 px-4",
        className,
      ].join(" ")}
      {...props}
    >
      {/* サイドバートグルボタン */}
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={isSidebarOpen ? "サイドバーを閉じる" : "サイドバーを開く"}
        aria-expanded={isSidebarOpen}
        className={[
          "w-8 h-8 flex items-center justify-center",
          "rounded-[var(--radius-sm)]",
          "text-[var(--color-text-muted)]",
          "hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]",
          "transition-colors duration-150",
        ].join(" ")}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          aria-hidden="true"
        >
          <rect y="3" width="18" height="1.5" rx="0.75" fill="currentColor" />
          <rect y="8.25" width="18" height="1.5" rx="0.75" fill="currentColor" />
          <rect y="13.5" width="18" height="1.5" rx="0.75" fill="currentColor" />
        </svg>
      </button>

      {/* サービス名 */}
      <span
        className="text-[22px] font-semibold text-[var(--color-text)] leading-none select-none"
        style={{ fontFamily: "var(--font-base)" }}
      >
        RGDシステム
      </span>

      <div className="flex-1" />

      {/* ユーザー情報 + ログアウト */}
      <div className="flex items-center gap-3">
        {userDisplayName && (
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-medium text-[var(--color-text)] leading-none">
              {userDisplayName}
            </span>
            {userRoleLabel && (
              <span className="text-xs text-[var(--color-text-muted)] leading-none mt-0.5">
                {userRoleLabel}
              </span>
            )}
          </div>
        )}

        {/* ログアウトフォーム */}
        <form action={logoutAction}>
          <button
            type="submit"
            className={[
              "h-8 px-3 text-xs font-medium",
              "rounded-[var(--radius-sm)]",
              "border border-[var(--color-border)]",
              "text-[var(--color-text-muted)]",
              "hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]",
              "transition-colors duration-150",
              "cursor-pointer",
            ].join(" ")}
          >
            ログアウト
          </button>
        </form>
      </div>
    </header>
  );
}
