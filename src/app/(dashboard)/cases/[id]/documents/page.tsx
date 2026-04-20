/**
 * 案件詳細 — 書類タブ
 *
 * 案件に紐づく全書類要件を一覧表示する。
 * 受講者個別タブは廃止し、案件単位で一元管理する。
 */

import { notFound, redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/session";
import {
  listAllRequirementsByCase,
  getCaseDocumentSummary,
  listDocumentTypes,
} from "@/server/repositories/documents";
import { getCase } from "@/server/repositories/cases";
import { CompletionBadge } from "@/components/domain/documents/CompletionBadge";
import { CasePageShell } from "@/components/domain";
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
    <CasePageShell
      caseId={caseId}
      caseCode={caseData.caseCode}
      caseName={caseData.caseName}
      caseStatus={caseData.status}
      operatingCompanyName={caseData.operatingCompanyName}
      organizationId={caseData.organizationId}
      organizationName={caseData.organizationName}
      activeTab="documents"
      sectionTitle="書類管理"
      sectionDescription="案件単位で必要書類の充足状況を確認します。"
    >
      {summary && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
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

      <DocumentTabClient
        caseId={caseId}
        organizationId={caseData.organizationId}
        requirements={requirements}
        documentTypes={documentTypes}
        userRoleCode={profile.roleCode}
      />
    </CasePageShell>
  );
}
