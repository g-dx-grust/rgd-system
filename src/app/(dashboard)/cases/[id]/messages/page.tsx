/**
 * 案件詳細 — 開始案内タブ
 *
 * ご案内書ファイルの保管・管理。
 */

import { notFound, redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { getCase } from "@/server/repositories/cases";
import { createClient } from "@/lib/supabase/server";
import { isMissingSupabaseRelationError } from "@/lib/supabase/errors";
import { GuidanceFileClient } from "./GuidanceFileClient";
import { CasePageShell } from "@/components/domain";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type GuidanceFileRow = {
  id: string;
  file_path: string;
  file_name: string;
  uploaded_at: string;
};

interface Props {
  params: Promise<{ id: string }>;
}

async function listGuidanceFiles(
  supabase: SupabaseClient,
  caseId: string
): Promise<{ available: boolean; rows: GuidanceFileRow[] }> {
  const { data, error } = await supabase
    .from("case_guidance_files")
    .select("id, file_path, file_name, uploaded_at")
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false });

  if (error) {
    if (isMissingSupabaseRelationError(error, ["case_guidance_files"])) {
      return { available: false, rows: [] };
    }
    throw new Error(error.message);
  }

  return { available: true, rows: (data ?? []) as GuidanceFileRow[] };
}

export default async function MessagesPage({ params }: Props) {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const { id: caseId } = await params;

  const supabase = await createClient();

  const [caseData, guidanceFiles] = await Promise.all([
    getCase(caseId),
    listGuidanceFiles(supabase, caseId),
  ]);

  if (!caseData) notFound();

  const fileRows = guidanceFiles.rows;

  const signedUrlMap: Record<string, string> = {};
  if (guidanceFiles.available && fileRows.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from("guidance-files")
      .createSignedUrls(
        fileRows.map((r) => r.file_path),
        3600
      );
    (signedUrls ?? []).forEach((s) => {
      if (s.path && s.signedUrl) signedUrlMap[s.path] = s.signedUrl;
    });
  }

  const files = fileRows.map((r) => ({
    id: r.id,
    fileName: r.file_name,
    uploadedAt: r.uploaded_at,
    signedUrl: signedUrlMap[r.file_path] ?? null,
  }));

  const canEdit = can(profile.roleCode, PERMISSIONS.CASE_EDIT);

  return (
    <CasePageShell
      caseId={caseId}
      caseCode={caseData.caseCode}
      caseName={caseData.caseName}
      caseStatus={caseData.status}
      operatingCompanyName={caseData.operatingCompanyName}
      organizationId={caseData.organizationId}
      organizationName={caseData.organizationName}
      activeTab="messages"
      sectionTitle="開始案内"
      sectionDescription="開始案内ファイルの保管と送付状況を管理します。"
    >
      {!caseData.acceptanceDate && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            受理日が登録されていません。受理日を登録してから開始案内を行ってください。
          </p>
        </div>
      )}

      {canEdit ? (
        <GuidanceFileClient
          caseId={caseId}
          files={files}
          isFeatureAvailable={guidanceFiles.available}
        />
      ) : (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            ご案内書の管理権限がありません。
          </p>
        </div>
      )}
    </CasePageShell>
  );
}
