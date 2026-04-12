/**
 * GET /api/cases/[id]/participants/[participantId]/documents
 *
 * 受講者に紐づく書類要件と最新ドキュメントを返す。
 * 権限: 内部ユーザー全員、client_portal_user は自組織案件のみ。
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { listRequirementsByParticipant } from "@/server/repositories/documents";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string; participantId: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (!profile.isActive) {
    return NextResponse.json({ error: "アカウントが無効です" }, { status: 403 });
  }
  if (profile.roleCode === "external_specialist") {
    return NextResponse.json({ error: "アクセス権限がありません" }, { status: 403 });
  }

  const { id: caseId, participantId } = await params;

  // client_portal_user の場合は自組織案件のみ許可
  if (profile.roleCode === "client_portal_user") {
    const supabase = await createClient();
    const { data: caseRow } = await supabase
      .from("cases")
      .select("organization_id")
      .eq("id", caseId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!caseRow || (caseRow.organization_id as string) !== profile.organizationId) {
      return NextResponse.json({ error: "アクセス権限がありません" }, { status: 403 });
    }
  }

  try {
    const requirements = await listRequirementsByParticipant(caseId, participantId);
    return NextResponse.json({ requirements });
  } catch (err) {
    console.error("[participant-documents] error:", err);
    return NextResponse.json(
      { error: "書類情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}
