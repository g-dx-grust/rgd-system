"use client";

import { type HTMLAttributes } from "react";
import { NotificationBell } from "./NotificationBell";

interface HeaderProps extends HTMLAttributes<HTMLElement> {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export function Header({
  onToggleSidebar,
  isSidebarOpen,
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

      <div className="flex-1" />
      <NotificationBell />
    </header>
  );
}
