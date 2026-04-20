/**
 * PATCH /api/cases/[id]/deficiencies/[defId]
 *
 * 内部スタッフが不備依頼を「解決済み」(resolved) に更新する。
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { updateDeficiencyStatus } from "@/server/repositories/specialist";
import { writeAuditLog } from "@/server/repositories/audit-log";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; defId: string }> }
) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (!can(profile.roleCode, PERMISSIONS.CASE_EDIT)) {
    return NextResponse.json({ error: "アクセス権限がありません" }, { status: 403 });
  }

  const { id: caseId, defId } = await params;
  const body = await req.json().catch(() => ({}));

  if (body?.status !== "resolved") {
    return NextResponse.json(
      { error: "内部スタッフは resolved への遷移のみ可能です" },
      { status: 400 }
    );
  }

  const result = await updateDeficiencyStatus({
    id:     defId,
    caseId,
    status: "resolved",
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
    metadata:   { caseId, status: "resolved" },
  });

  return NextResponse.json({ ok: true });
}
