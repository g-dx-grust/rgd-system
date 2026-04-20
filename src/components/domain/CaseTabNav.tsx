import Link from "next/link";

const CASE_TABS = [
  { label: "概要", key: "overview", href: (id: string) => `/cases/${id}` },
  { label: "受講者", key: "participants", href: (id: string) => `/cases/${id}/participants` },
  { label: "書類", key: "documents", href: (id: string) => `/cases/${id}/documents` },
  { label: "申請", key: "applications", href: (id: string) => `/cases/${id}/applications` },
  { label: "請求", key: "billing", href: (id: string) => `/cases/${id}/billing` },
  { label: "証憑", key: "evidence", href: (id: string) => `/cases/${id}/evidence` },
  { label: "開始案内", key: "messages", href: (id: string) => `/cases/${id}/messages` },
  { label: "LMS進捗", key: "lms", href: (id: string) => `/cases/${id}/lms` },
  { label: "終了申請", key: "completion", href: (id: string) => `/cases/${id}/completion` },
  { label: "不備依頼", key: "deficiencies", href: (id: string) => `/cases/${id}/deficiencies` },
  { label: "社労士連絡", key: "specialistComments", href: (id: string) => `/cases/${id}/specialist-comments` },
  { label: "変更履歴", key: "timeline", href: (id: string) => `/cases/${id}/timeline` },
] as const;

export type CaseTabKey = (typeof CASE_TABS)[number]["key"];

interface Props {
  caseId:    string;
  activeTab: CaseTabKey;
}

export function CaseTabNav({ caseId, activeTab }: Props) {
  return (
    <nav className="flex h-[52px] min-h-[52px] border-b border-[var(--color-border)] gap-0 overflow-x-auto">
      {CASE_TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href(caseId)}
          className={[
            "flex flex-none items-center h-full px-4 text-sm border-b-2 transition-colors whitespace-nowrap",
            tab.key === activeTab
              ? "border-[var(--color-accent)] text-[var(--color-accent)] font-medium"
              : "border-transparent text-[var(--color-text-sub)] hover:text-[var(--color-text)]",
          ].join(" ")}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
