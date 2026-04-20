/**
 * 社労士専用 — 書類DL・提出画面
 * /external/specialist/cases/[id]/documents
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { getSpecialistCaseDetail } from "@/server/repositories/specialist";
import { DocumentsClient } from "./DocumentsClient";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const profile = await getCurrentUserProfile();
  if (!profile) return { title: "書類管理 | RGDシステム" };
  const detail = await getSpecialistCaseDetail(id, profile.id);
  return {
    title: detail
      ? `書類管理 — ${detail.caseName} | RGDシステム 社労士ポータル`
      : "書類管理 | RGDシステム",
  };
}

export default async function SpecialistDocumentsPage({ params }: Props) {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.roleCode !== "external_specialist") {
    redirect("/external/specialist/login");
  }

  const { id: caseId } = await params;
  const detail = await getSpecialistCaseDetail(caseId, profile.id);

  if (!detail) notFound();

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Tokyo",
    });
  }

  return (
    <div className="space-y-5">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <Link href="/external/specialist/cases" className="hover:text-[var(--color-accent)]">
          担当案件一覧
        </Link>
        <span>/</span>
        <span>{detail.caseCode}</span>
        <span>/</span>
        <span>書類・提出</span>
      </div>

      {/* 案件ヘッダー */}
      <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] px-5 py-4">
        <p className="text-xs text-[var(--color-text-muted)] mb-0.5">{detail.caseCode}</p>
        <h1 className="text-[20px] font-semibold text-[var(--color-text)]">
          {detail.caseName}
        </h1>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--color-text-sub)]">
          <span>
            <span className="text-xs text-[var(--color-text-muted)]">企業名：</span>
            {detail.organizationName}
          </span>
          <span>
            <span className="text-xs text-[var(--color-text-muted)]">運営：</span>
            {detail.operatingCompanyName}
          </span>
          <span>
            <span className="text-xs text-[var(--color-text-muted)]">研修期間：</span>
            {formatDate(detail.plannedStartDate)} 〜 {formatDate(detail.plannedEndDate)}
          </span>
          <span>
            <span className="text-xs text-[var(--color-text-muted)]">最終申請期限：</span>
            <span className={detail.finalApplicationDueDate && new Date(detail.finalApplicationDueDate) < new Date() && !detail.finalCompletedAt ? "text-[#DC2626] font-medium" : ""}>
              {formatDate(detail.finalApplicationDueDate)}
            </span>
          </span>
        </div>
      </div>

      {/* タブナビ */}
      <nav className="flex gap-0 border-b border-[var(--color-border)]">
        {[
          { label: "書類・提出", href: `/external/specialist/cases/${caseId}/documents`, active: true },
          { label: "不備依頼",   href: `/external/specialist/cases/${caseId}/deficiencies` },
          { label: "コメント",   href: `/external/specialist/cases/${caseId}/comments` },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={[
              "border-b-2 px-4 py-2.5 text-sm whitespace-nowrap transition-colors",
              tab.active
                ? "border-[var(--color-accent)] font-medium text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-text-sub)] hover:text-[var(--color-text)]",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* クライアントコンポーネント（書類DL・提出・受講者一覧） */}
      <DocumentsClient
        caseId={caseId}
        documents={detail.documents}
        participants={detail.participants}
        submittedAt={detail.submittedAt}
        submissionMethod={detail.submissionMethod}
        finalCompletedAt={detail.finalCompletedAt}
      />
    </div>
  );
}
