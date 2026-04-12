/**
 * 申請タブ ページ
 *
 * /cases/[id]/applications
 *
 * Server Component:
 * - 案件・書類・パッケージ情報を取得してクライアントコンポーネントに渡す
 * - 初回申請可否チェック結果を表示
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { getCase } from "@/server/repositories/cases";
import { listApplicationPackages } from "@/server/repositories/application-packages";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { checkPreApplicationReadiness } from "@/server/services/application-packages";
import { PreApplicationReadinessCheck } from "@/components/domain/applications/PreApplicationReadinessCheck";
import { ApplicationsTabClient } from "./ApplicationsTabClient";
import type { SelectableDocument } from "@/components/domain/applications/PackageFileSelector";
import { createClient } from "@/lib/supabase/server";
import { CaseTabNav } from "@/components/domain";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCase(id);
  return { title: c ? `申請 | ${c.caseName} | RGDシステム` : "申請 | RGDシステム" };
}

export default async function ApplicationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user, caseData] = await Promise.all([
    getCurrentUserProfile(),
    getCase(id),
  ]);

  if (!caseData) notFound();

  const canEdit         = can(user?.roleCode, PERMISSIONS.CASE_EDIT);
  const canStatusChange = can(user?.roleCode, PERMISSIONS.CASE_STATUS_CHANGE);

  const [readiness, packages, approvedDocs] = await Promise.all([
    checkPreApplicationReadiness(id),
    listApplicationPackages(id),
    fetchApprovedDocuments(id),
  ]);

  return (
    <div className="space-y-5">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <Link href="/cases" className="hover:text-[var(--color-accent)]">案件管理</Link>
        <span>/</span>
        <Link href={`/cases/${id}`} className="hover:text-[var(--color-accent)]">{caseData.caseCode}</Link>
        <span>/</span>
        <span>申請</span>
      </div>

      {/* タブナビ */}
      <CaseTabNav caseId={id} activeTab="applications" />

      {/* 充足チェック */}
      <PreApplicationReadinessCheck result={readiness} />

      {/* クライアントコンポーネント（パッケージ操作） */}
      <ApplicationsTabClient
        caseId={id}
        caseCode={caseData.caseCode}
        currentStatus={caseData.status}
        isReady={readiness.ready}
        canEdit={canEdit}
        canStatusChange={canStatusChange}
        documents={approvedDocs}
        packages={packages}
      />
    </div>
  );
}

// ------------------------------------------------------------
// 承認済み書類一覧取得（ファイル選定用）
// ------------------------------------------------------------

async function fetchApprovedDocuments(caseId: string): Promise<SelectableDocument[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select(
      `id, original_filename, mime_type, version_no, review_status,
       document_type_id,
       document_types ( name ),
       participant_id,
       participants ( name )`
    )
    .eq("case_id", caseId)
    .in("review_status", ["approved", "received"])
    .is("deleted_at", null)
    .order("document_type_id", { ascending: true });

  if (error) return [];

  return (data ?? []).map((row) => {
    const dt = row["document_types"] as { name?: unknown } | null | undefined;
    const pt = row["participants"]   as { name?: unknown } | null | undefined;
    const typeName      = dt && !Array.isArray(dt) ? dt["name"] : undefined;
    const participantName = pt && !Array.isArray(pt) ? pt["name"] : undefined;
    return {
      documentId:       String(row["id"]),
      originalFilename: String(row["original_filename"]),
      documentTypeName: typeName != null ? String(typeName) : "—",
      participantName:  participantName != null ? String(participantName) : null,
      versionNo:        Number(row["version_no"] ?? 1),
      reviewStatus:     String(row["review_status"]),
    };
  });
}
