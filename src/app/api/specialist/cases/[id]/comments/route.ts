/**
 * GET  /api/specialist/cases/[id]/comments  — コメント一覧（社労士用）
 * POST /api/specialist/cases/[id]/comments  — コメント投稿（社労士用）
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  listSpecialistComments,
  createSpecialistComment,
} from "@/server/repositories/specialist";
import { writeAuditLog } from "@/server/repositories/audit-log";
import { notifyInternalStaff } from "@/server/repositories/notifications";

const postSchema = z.object({
  body:      z.string().min(1).max(5000),
  parent_id: z.string().uuid().nullable().optional(),
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

  const comments = await listSpecialistComments(caseId);
  return NextResponse.json({ comments });
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
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力内容が不正です" }, { status: 400 });
  }

  const result = await createSpecialistComment({
    caseId,
    authorId:         profile.id,
    body:             parsed.data.body,
    isFromSpecialist: true,
    parentId:         parsed.data.parent_id ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "送信に失敗しました" }, { status: 500 });
  }

  void writeAuditLog({
    userId:     profile.id,
    action:     "specialist_comment_create",
    targetType: "specialist_comment",
    targetId:   result.id,
    metadata:   { caseId, isFromSpecialist: true },
  });

  void notifyInternalStaff({
    caseId,
    title:    "社労士よりコメントが届きました",
    body:     parsed.data.body.slice(0, 80) + (parsed.data.body.length > 80 ? "…" : ""),
    linkUrl:  `/cases/${caseId}/specialist-comments`,
    category: "info",
  });

  return NextResponse.json({ id: result.id }, { status: 201 });
}
