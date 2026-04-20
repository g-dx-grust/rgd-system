/**
 * 社労士専用 — 訓練会社とのコメントスレッド
 * /external/specialist/cases/[id]/comments
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { getSpecialistCaseDetail, listSpecialistComments } from "@/server/repositories/specialist";
import { CommentsClient } from "./CommentsClient";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const profile = await getCurrentUserProfile();
  if (!profile) return { title: "コメント | RGDシステム" };
  const detail = await getSpecialistCaseDetail(id, profile.id);
  return {
    title: detail
      ? `コメント — ${detail.caseName} | RGDシステム 社労士ポータル`
      : "コメント | RGDシステム",
  };
}

export default async function SpecialistCommentsPage({ params }: Props) {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.roleCode !== "external_specialist") {
    redirect("/external/specialist/login");
  }

  const { id: caseId } = await params;
  const [detail, comments] = await Promise.all([
    getSpecialistCaseDetail(caseId, profile.id),
    listSpecialistComments(caseId),
  ]);

  if (!detail) notFound();

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
        <span>コメント</span>
      </div>

      {/* 案件ヘッダー */}
      <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] px-5 py-4">
        <p className="text-xs text-[var(--color-text-muted)] mb-0.5">{detail.caseCode}</p>
        <h1 className="text-[20px] font-semibold text-[var(--color-text)]">
          {detail.caseName}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-sub)]">
          <span className="text-xs text-[var(--color-text-muted)] mr-1">企業名：</span>
          {detail.organizationName}
        </p>
      </div>

      {/* タブナビ */}
      <nav className="flex gap-0 border-b border-[var(--color-border)]">
        {[
          { label: "書類・提出", href: `/external/specialist/cases/${caseId}/documents` },
          { label: "不備依頼",   href: `/external/specialist/cases/${caseId}/deficiencies` },
          { label: "コメント",   href: `/external/specialist/cases/${caseId}/comments`, active: true },
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

      {/* クライアントコンポーネント */}
      <CommentsClient
        caseId={caseId}
        initialComments={comments}
        apiBase={`/api/specialist/cases/${caseId}/comments`}
        currentUserIsSpecialist
      />
    </div>
  );
}
