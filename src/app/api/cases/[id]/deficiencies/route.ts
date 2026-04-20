/**
 * GET /api/cases/[id]/deficiencies  — 不備依頼一覧（内部スタッフ用）
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { listDeficiencyRequests } from "@/server/repositories/specialist";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (!can(profile.roleCode, PERMISSIONS.CASE_VIEW_OWN) && !can(profile.roleCode, PERMISSIONS.CASE_VIEW_ALL)) {
    return NextResponse.json({ error: "アクセス権限がありません" }, { status: 403 });
  }

  const { id: caseId } = await params;
  const rows = await listDeficiencyRequests(caseId);
  return NextResponse.json({ deficiencies: rows });
}
