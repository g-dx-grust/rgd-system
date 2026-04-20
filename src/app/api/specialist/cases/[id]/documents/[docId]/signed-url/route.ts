/**
 * GET /api/specialist/cases/[id]/documents/[docId]/signed-url
 *
 * 社労士専用 — 書類の署名付き閲覧URLを発行する（300秒有効）。
 *
 * 権限ルール:
 *   - external_specialist ロールのみ
 *   - specialist_cases で当該案件の担当者として登録されていること
 *   - 書類が当該案件に属すること
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { getDocumentById } from "@/server/repositories/documents";
import { createSpecialistSignedUrl } from "@/server/repositories/specialist";
import { writeAuditLog } from "@/server/repositories/audit-log";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (profile.roleCode !== "external_specialist" || !profile.isActive) {
    return NextResponse.json({ error: "アクセス権限がありません" }, { status: 403 });
  }

  const { id: caseId, docId } = await params;

  // specialist_cases で担当確認（RLS も通る）
  const supabase = await createClient();
  const { data: sc } = await supabase
    .from("specialist_cases")
    .select("id")
    .eq("case_id", caseId)
    .eq("specialist_user_id", profile.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!sc) {
    return NextResponse.json({ error: "アクセス権限がありません" }, { status: 403 });
  }

  // 書類が当該案件に属するか確認
  const document = await getDocumentById(docId).catch(() => null);
  if (!document || document.caseId !== caseId || document.deletedAt) {
    return NextResponse.json({ error: "書類が見つかりません" }, { status: 404 });
  }

  try {
    const signedUrl = await createSpecialistSignedUrl(
      document.storageBucket,
      document.storagePath,
      300
    );
    const expiresAt = new Date(Date.now() + 300 * 1000).toISOString();

    void writeAuditLog({
      userId:     profile.id,
      action:     "specialist_document_download",
      targetType: "document",
      targetId:   document.id,
      metadata:   { caseId, filename: document.originalFilename },
    });

    return NextResponse.json({ signedUrl, expiresAt });
  } catch (err) {
    console.error("[specialist signed-url] error:", err);
    return NextResponse.json({ error: "閲覧URLの発行に失敗しました" }, { status: 500 });
  }
}
