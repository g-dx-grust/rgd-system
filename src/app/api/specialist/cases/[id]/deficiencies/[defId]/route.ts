/**
 * PATCH /api/specialist/cases/[id]/deficiencies/[defId]
 *
 * 社労士が不備依頼を「対応済み」(responded) に更新する。
 * resolved（確認済み）への遷移は内部スタッフ側 API が担う。
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { updateDeficiencyStatus } from "@/server/repositories/specialist";
import { writeAuditLog } from "@/server/repositories/audit-log";
import { notifyInternalStaff } from "@/server/repositories/notifications";

async function assertSpecialistAccess(
  caseId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("specialist_cases")
    .select("id")
    .eq("case_id", caseId)
    .eq("specialist_user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return !!data;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; defId: string }> }
) {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.roleCode !== "external_specialist" || !profile.isActive) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: caseId, defId } = await params;
  const hasAccess = await assertSpecialistAccess(caseId, profile.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "アクセス権限がありません" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (body?.status !== "responded") {
    return NextResponse.json(
      { error: "社労士は responded への遷移のみ可能です" },
      { status: 400 }
    );
  }

  const result = await updateDeficiencyStatus({
    id:     defId,
    caseId,
    status: "responded",
    userId: profile.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "更新に失敗しました" }, { status: 500 });
  }

  void writeAuditLog({
    userId:     profile.id,
    action:     "deficiency_status_update",
    targetType: "deficiency_request",
    targetId:   defId,
    metadata:   { caseId, status: "responded" },
  });

  void notifyInternalStaff({
    caseId,
    title:    "不備依頼が「対応済み」に更新されました",
    body:     "社労士が不備依頼を対応済みとしました。確認・解決済みへの移行をお願いします。",
    linkUrl:  `/cases/${caseId}/deficiencies`,
    category: "task",
  });

  return NextResponse.json({ ok: true });
}
