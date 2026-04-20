"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  linkUrl: string | null;
  category: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsApiResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/notifications/count")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { count: number }) => setCount(data.count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  const handleToggle = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    fetch("/api/notifications?unreadOnly=true")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: NotificationsApiResponse) => {
        setNotifications(data.notifications.slice(0, 5));
        setCount(data.unreadCount);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <div ref={ref} className="relative flex items-center gap-3">
      {count > 0 && (
        <span className="text-sm text-[var(--color-text-muted)]">
          未読通知{" "}
          <span className="font-medium text-[var(--color-text)]">{count}件</span>
        </span>
      )}

      <button
        type="button"
        onClick={handleToggle}
        aria-label="通知を開く"
        aria-expanded={open}
        className={[
          "relative w-8 h-8 flex items-center justify-center",
          "rounded-[var(--radius-sm)]",
          "text-[var(--color-text-muted)]",
          "hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text)]",
          "transition-colors duration-150",
        ].join(" ")}
      >
        <BellIcon />
        {count > 0 && (
          <span
            aria-hidden="true"
            className={[
              "absolute -top-0.5 -right-0.5",
              "min-w-[16px] h-4 px-1",
              "flex items-center justify-center",
              "rounded-[var(--radius-sm)]",
              "bg-[var(--color-accent)] text-white font-medium",
            ].join(" ")}
            style={{ fontSize: "10px", lineHeight: 1 }}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="通知一覧"
          className={[
            "absolute right-0 top-10 z-50",
            "w-80",
            "rounded-[var(--radius-md)]",
            "border border-[var(--color-border)]",
            "bg-white",
          ].join(" ")}
          style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
        >
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
            <span className="text-sm font-semibold text-[var(--color-text)]">
              通知
            </span>
            {count > 0 && (
              <span className="text-xs text-[var(--color-text-muted)]">
                未読 {count}件
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
                読み込み中...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
                未読の通知はありません
              </div>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className="border-b border-[var(--color-border)] last:border-b-0"
                  >
                    {n.linkUrl ? (
                      <Link
                        href={n.linkUrl}
                        onClick={() => setOpen(false)}
                        className="block px-4 py-3 hover:bg-[var(--color-bg-secondary)] transition-colors"
                      >
                        <NotificationContent notification={n} />
                      </Link>
                    ) : (
                      <div className="px-4 py-3">
                        <NotificationContent notification={n} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-[var(--color-border)] px-4 py-2.5">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
            >
              すべての通知を見る
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationContent({
  notification,
}: {
  notification: NotificationItem;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-sm font-medium text-[var(--color-text)] line-clamp-1">
        {notification.title}
      </p>
      {notification.body && (
        <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">
          {notification.body}
        </p>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 2.25A4.5 4.5 0 004.5 6.75v.562L3 9.563V10.5h12V9.563l-1.5-2.25V6.75A4.5 4.5 0 009 2.25z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 10.5a1.5 1.5 0 003 0"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}
