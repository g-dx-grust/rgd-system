"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** サイドバーナビゲーションアイテム */
interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  isOpen: boolean;
}

/** 展開時: 200px / 折りたたみ時: 56px */
const SIDEBAR_EXPANDED_WIDTH = 200;
const SIDEBAR_COLLAPSED_WIDTH = 56;

const NAV_ITEMS: NavItem[] = [
  {
    label: "ダッシュボード",
    href: "/dashboard",
    icon: <DashboardIcon />,
  },
  {
    label: "案件管理",
    href: "/cases",
    icon: <CasesIcon />,
  },
  {
    label: "企業管理",
    href: "/organizations",
    icon: <OrgIcon />,
  },
  {
    label: "受講者管理",
    href: "/participants",
    icon: <ParticipantsIcon />,
  },
  {
    label: "書類管理",
    href: "/documents",
    icon: <DocumentsIcon />,
  },
  {
    label: "請求管理",
    href: "/billing",
    icon: <BillingIcon />,
  },
  {
    label: "LMS進捗",
    href: "/lms",
    icon: <LmsIcon />,
  },
  {
    label: "通知センター",
    href: "/notifications",
    icon: <NotificationIcon />,
  },
  {
    label: "監査ログ",
    href: "/admin/audit-logs",
    icon: <AuditLogIcon />,
  },
  {
    label: "設定",
    href: "/settings",
    icon: <SettingsIcon />,
  },
];

export function Sidebar({ isOpen }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={[
        "flex-shrink-0",
        "bg-[#F8F8F8]",
        "border-r border-[var(--color-border)]",
        "flex flex-col",
        "overflow-hidden",
        "transition-[width] duration-200 ease-in-out",
      ].join(" ")}
      style={{
        width: isOpen ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH,
      }}
      aria-label="メインナビゲーション"
    >
      <nav className="flex flex-col gap-0.5 p-2 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={!isOpen ? item.label : undefined}
              className={[
                "flex items-center gap-2.5",
                "px-3 py-2.5",
                "rounded-[var(--radius-sm)]",
                "text-sm transition-colors duration-100",
                "whitespace-nowrap overflow-hidden",
                isActive
                  ? "bg-[var(--color-accent-tint)] text-[var(--color-accent)] font-medium"
                  : "text-[var(--color-text-sub)] hover:bg-[rgba(26,86,219,0.06)] hover:text-[var(--color-accent)]",
              ].join(" ")}
            >
              <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                {item.icon}
              </span>
              {isOpen && (
                <span className="truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

/* ==================== アイコン ==================== */
function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CasesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="3.5" width="13" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 3.5V2.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 8h8M4 11h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function OrgIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="6" width="14" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 1.5h4M8 1.5v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function NotificationIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.5a5 5 0 0 1 5 5v3l1 1.5H2L3 9.5v-3a5 5 0 0 1 5-5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.5 12.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function AuditLogIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 2.5h10a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 5.5h7M4.5 8h7M4.5 10.5h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function ParticipantsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.5 13.5c0-2.485 2.015-4.5 4.5-4.5s4.5 2.015 4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 7.5a2 2 0 1 0 0-4M14.5 13.5c0-2.071-1.567-3.775-3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DocumentsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M9.5 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5L9.5 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9.5 1.5V5.5H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8.5h6M5 11h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function BillingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 9.5h2M4 11h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <rect x="9" y="9" width="3.5" height="2.5" rx="0.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

function LmsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.5L14.5 5v6L8 14.5 1.5 11V5L8 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 1.5V8m0 0l6.5-3M8 8L1.5 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
