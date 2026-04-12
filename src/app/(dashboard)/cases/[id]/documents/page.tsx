/**
 * 案件詳細 — 書類タブ
 *
 * 案件に紐づく全書類要件を一覧表示する。
 * 受講者個別タブは廃止し、案件単位で一元管理する。
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/session";
import {
  listAllRequirementsByCase,
  getCaseDocumentSummary,
  listDocumentTypes,
} from "@/server/repositories/documents";
import { getCase } from "@/server/repositories/cases";
import { CompletionBadge } from "@/components/domain/documents/CompletionBadge";
import { CaseTabNav } from "@/components/domain";
import { DocumentTabClient } from "./DocumentTabClient";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const c = await getCase(id);
  return { title: c ? `書類管理 — ${c.caseName} | RGDシステム` : "書類管理 | RGDシステム" };
}

export default async function DocumentsPage({ params }: Props) {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const { id: caseId } = await params;

  const [caseData, requirements, summary, documentTypes] = await Promise.all([
    getCase(caseId),
    listAllRequirementsByCase(caseId),
    getCaseDocumentSummary(caseId),
    listDocumentTypes(),
  ]);

  if (!caseData) notFound();

  return (
    <div className="space-y-5">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <Link href="/cases" className="hover:text-[var(--color-accent)]">案件管理</Link>
        <span>/</span>
        <Link href={`/cases/${caseId}`} className="hover:text-[var(--color-accent)]">
          {caseData.caseCode}
        </Link>
        <span>/</span>
        <span>書類管理</span>
      </div>

      {/* ページタイトル */}
      <h1 className="text-[22px] font-semibold text-[var(--color-text)]">
        {caseData.caseName}
        <span className="ml-2 text-base font-normal text-[var(--color-text-muted)]">書類管理</span>
      </h1>

      {/* タブナビ */}
      <CaseTabNav caseId={caseId} activeTab="documents" />

      {/* 全体充足率 */}
      {summary && (
        <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--color-text)]">
              必須書類充足率
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {summary.approvedCount}/{summary.requiredCount} 件確定
            </span>
          </div>
          <CompletionBadge summary={summary} />
        </div>
      )}

      {/* 書類管理クライアントコンポーネント */}
      <DocumentTabClient
        caseId={caseId}
        organizationId={caseData.organizationId}
        requirements={requirements}
        documentTypes={documentTypes}
        userRoleCode={profile.roleCode}
      />
    </div>
  );
}
