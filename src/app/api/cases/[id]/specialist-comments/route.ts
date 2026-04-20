/**
 * GET  /api/cases/[id]/specialist-comments  — コメント一覧（内部スタッフ用）
 * POST /api/cases/[id]/specialist-comments  — コメント投稿（内部スタッフ用）
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import {
  listSpecialistComments,
  createSpecialistComment,
} from "@/server/repositories/specialist";
import { writeAuditLog } from "@/server/repositories/audit-log";

const postSchema = z.object({
  body:      z.string().min(1).max(5000),
  parent_id: z.string().uuid().nullable().optional(),
});

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
  const comments = await listSpecialistComments(caseId);
  return NextResponse.json({ comments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (!can(profile.roleCode, PERMISSIONS.CASE_EDIT)) {
    return NextResponse.json({ error: "アクセス権限がありません" }, { status: 403 });
  }

  const { id: caseId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力内容が不正です" }, { status: 400 });
  }

  const result = await createSpecialistComment({
    caseId,
    authorId:         profile.id,
    body:             parsed.data.body,
    isFromSpecialist: false,
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
    metadata:   { caseId, isFromSpecialist: false },
  });

  return NextResponse.json({ id: result.id }, { status: 201 });
}
