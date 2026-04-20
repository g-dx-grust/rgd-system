/**
 * 内部スタッフ — 社労士コメントスレッド
 * /cases/[id]/specialist-comments
 */

import { notFound } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { CasePageShell } from "@/components/domain";
import { getCase } from "@/server/repositories/cases";
import { listSpecialistComments } from "@/server/repositories/specialist";
import { CommentsClient } from "@/app/external/specialist/cases/[id]/comments/CommentsClient";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const c = await getCase(id);
  return {
    title: c ? `社労士コメント — ${c.caseName} | RGDシステム` : "社労士コメント | RGDシステム",
  };
}

export default async function CaseSpecialistCommentsPage({ params }: Props) {
  const { id } = await params;
  const [profile, caseData, comments] = await Promise.all([
    getCurrentUserProfile(),
    getCase(id),
    listSpecialistComments(id),
  ]);

  if (!caseData) notFound();

  const canPost = can(profile?.roleCode, PERMISSIONS.CASE_EDIT);

  return (
    <CasePageShell
      caseId={id}
      caseCode={caseData.caseCode}
      caseName={caseData.caseName}
      caseStatus={caseData.status}
      operatingCompanyName={caseData.operatingCompanyName}
      organizationId={caseData.organizationId}
      organizationName={caseData.organizationName}
      activeTab="specialistComments"
      sectionTitle="社労士連絡"
      sectionDescription="社労士と訓練会社の連絡スレッドです。全操作が監査ログに記録されます。"
    >
      {canPost ? (
        <CommentsClient
          caseId={id}
          initialComments={comments}
          apiBase={`/api/cases/${id}/specialist-comments`}
          currentUserIsSpecialist={false}
        />
      ) : (
        <div className="space-y-3">
          {comments.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-5 py-10 text-center text-sm text-[var(--color-text-muted)]">
              コメントはまだありません
            </div>
          ) : (
            comments.map((c) => (
              <div
                key={c.id}
                className={[
                  "rounded-[var(--radius-md)] border p-4 space-y-1",
                  c.isFromSpecialist
                    ? "bg-[var(--color-accent-tint)] border-[var(--color-accent)] ml-auto max-w-[80%]"
                    : "bg-white border-[var(--color-border)] mr-auto max-w-[80%]",
                ].join(" ")}
              >
                <p className="text-xs font-medium text-[var(--color-text-muted)]">
                  {c.isFromSpecialist ? `社労士 · ${c.authorName ?? "—"}` : `訓練会社 · ${c.authorName ?? "—"}`}
                </p>
                <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">{c.body}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {new Date(c.createdAt).toLocaleString("ja-JP", {
                    month: "2-digit", day: "2-digit",
                    hour: "2-digit", minute: "2-digit",
                    timeZone: "Asia/Tokyo",
                  })}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </CasePageShell>
  );
}
