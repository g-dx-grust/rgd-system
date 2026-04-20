import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui";
import type { CaseStatus } from "@/lib/constants/case-status";
import { CaseStatusBadge } from "./CaseStatusBadge";
import { CaseTabNav, type CaseTabKey } from "./CaseTabNav";

interface CasePageShellProps {
  caseId: string;
  caseCode: string;
  caseName: string;
  caseStatus: CaseStatus;
  operatingCompanyName?: string | null;
  organizationId?: string | null;
  organizationName?: string | null;
  activeTab: CaseTabKey;
  sectionTitle: string;
  sectionDescription?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function CasePageShell({
  caseId,
  caseCode,
  caseName,
  caseStatus,
  operatingCompanyName,
  organizationId,
  organizationName,
  activeTab,
  sectionTitle,
  sectionDescription,
  action,
  children,
}: CasePageShellProps) {
  const hasOrganizationLink = !!organizationId && !!organizationName;

  return (
    <div className="space-y-5">
      <div className="flex h-5 items-center gap-2 overflow-hidden text-xs text-[var(--color-text-muted)]">
        <Link href="/cases" className="truncate hover:text-[var(--color-accent)]">
          案件管理
        </Link>
        <span>/</span>
        <Link
          href={`/cases/${caseId}`}
          className="truncate hover:text-[var(--color-accent)]"
        >
          {caseCode}
        </Link>
        <span>/</span>
        <span className="truncate">{sectionTitle}</span>
      </div>

      <div className="flex min-h-[112px] items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex h-7 items-center gap-2 overflow-x-auto whitespace-nowrap">
            <span className="inline-flex h-7 items-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 text-xs font-medium text-[var(--color-text-sub)]">
              {sectionTitle}
            </span>
            <CaseStatusBadge status={caseStatus} />
            {operatingCompanyName ? (
              <Badge
                variant={
                  operatingCompanyName.includes("グラスト") ? "accent" : "default"
                }
              >
                {operatingCompanyName}
              </Badge>
            ) : null}
          </div>

          <div className="mt-2 flex h-8 items-center">
            <h1 className="w-full truncate text-[22px] font-semibold text-[var(--color-text)]">
              {caseName}
            </h1>
          </div>

          <div className="mt-2 flex h-5 items-center overflow-hidden text-sm text-[var(--color-text-muted)]">
            <span className="truncate">{caseCode}</span>
            {hasOrganizationLink ? (
              <>
                <span className="mx-2">/</span>
                <Link
                  href={`/organizations/${organizationId}`}
                  className="truncate text-[var(--color-accent)] hover:underline"
                >
                  {organizationName}
                </Link>
              </>
            ) : null}
          </div>

          <div className="mt-1 flex h-5 items-center overflow-hidden text-sm text-[var(--color-text-muted)]">
            <p className="w-full truncate">{sectionDescription ?? "\u00a0"}</p>
          </div>
        </div>

        {action ? (
          <div className="flex shrink-0 items-start gap-2">{action}</div>
        ) : null}
      </div>

      <CaseTabNav caseId={caseId} activeTab={activeTab} />

      {children}
    </div>
  );
}
