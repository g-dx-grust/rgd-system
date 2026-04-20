/**
 * GET  /api/specialist/cases/[id]/deficiencies  — 不備依頼一覧（社労士用）
 * POST /api/specialist/cases/[id]/deficiencies  — 不備依頼作成（社労士用）
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  listDeficiencyRequests,
  createDeficiencyRequest,
} from "@/server/repositories/specialist";
import { writeAuditLog } from "@/server/repositories/audit-log";
import { notifyInternalStaff } from "@/server/repositories/notifications";

const createSchema = z.object({
  description:   z.string().min(1).max(2000),
  required_files: z
    .array(z.object({ label: z.string().min(1), note: z.string().optional() }))
    .default([]),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.roleCode !== "external_specialist" || !profile.isActive) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: caseId } = await params;
  const hasAccess = await assertSpecialistAccess(caseId, profile.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "アクセス権限がありません" }, { status: 403 });
  }

  const rows = await listDeficiencyRequests(caseId);
  return NextResponse.json({ deficiencies: rows });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.roleCode !== "external_specialist" || !profile.isActive) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: caseId } = await params;
  const hasAccess = await assertSpecialistAccess(caseId, profile.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "アクセス権限がありません" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力内容が不正です", issues: parsed.error.issues }, { status: 400 });
  }

  const result = await createDeficiencyRequest({
    caseId,
    createdBy:     profile.id,
    description:   parsed.data.description,
    requiredFiles: parsed.data.required_files,
    deadline:      parsed.data.deadline ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "作成に失敗しました" }, { status: 500 });
  }

  void writeAuditLog({
    userId:     profile.id,
    action:     "deficiency_create",
    targetType: "deficiency_request",
    targetId:   result.id,
    metadata:   { caseId, description: parsed.data.description },
  });

  void notifyInternalStaff({
    caseId,
    title:   "不備依頼が登録されました",
    body:    `社労士より不備依頼が入力されました。内容を確認してください。`,
    linkUrl: `/cases/${caseId}/deficiencies`,
    category: "task",
  });

  return NextResponse.json({ id: result.id }, { status: 201 });
}
