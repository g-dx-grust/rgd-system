/**
 * 案件一括操作 API
 *
 * POST /api/cases/bulk
 *
 * body: {
 *   action: "change_owner" | "add_return_task",
 *   caseIds: string[],
 *   ownerUserId?: string,    // change_owner 時に必須
 *   returnReason?: string,   // add_return_task 時に使用
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/server/repositories/audit-log";

const MAX_BULK = 100;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

interface BulkBody {
  action?: unknown;
  caseIds?: unknown;
  ownerUserId?: unknown;
  returnReason?: unknown;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUserProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  requirePermission(user.roleCode, PERMISSIONS.CASE_EDIT);

  let body: BulkBody;
  try {
    body = (await req.json()) as BulkBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action  = typeof body.action  === "string" ? body.action  : null;
  const caseIds = Array.isArray(body.caseIds)
    ? (body.caseIds as unknown[]).filter(isUuid)
    : [];

  if (!action) {
    return NextResponse.json({ error: "action is required" }, { status: 422 });
  }
  if (caseIds.length === 0 || caseIds.length > MAX_BULK) {
    return NextResponse.json(
      { error: `caseIds must be 1–${MAX_BULK} valid UUIDs` },
      { status: 422 }
    );
  }

  const supabase = await createClient();

  if (action === "change_owner") {
    const ownerUserId = body.ownerUserId;
    if (!isUuid(ownerUserId)) {
      return NextResponse.json({ error: "ownerUserId must be a valid UUID" }, { status: 422 });
    }

    const { error } = await supabase
      .from("cases")
      .update({ owner_user_id: ownerUserId, updated_at: new Date().toISOString() })
      .in("id", caseIds)
      .is("deleted_at", null);

    if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });

    await writeAuditLog({
      userId:     user.id,
      action:     "bulk_owner_change",
      targetType: "case",
      metadata:   { caseIds, newOwnerUserId: ownerUserId, count: caseIds.length },
    });

    return NextResponse.json({ success: true, updated: caseIds.length });
  }

  if (action === "add_return_task") {
    const returnReason =
      typeof body.returnReason === "string" && body.returnReason.trim().length > 0
        ? body.returnReason.trim().slice(0, 500)
        : null;

    const now = new Date().toISOString();
    const tasks = caseIds.map((caseId) => ({
      case_id:           caseId,
      title:             "不備再依頼の確認",
      description:       returnReason ?? "書類不備の再依頼が発生しました。確認・対応してください。",
      status:            "open",
      priority:          "high",
      assignee_user_id:  null as string | null,
      due_date:          null as string | null,
      generated_by_rule: "bulk_return_task",
      created_at:        now,
      updated_at:        now,
    }));

    const { error } = await supabase.from("tasks").insert(tasks);

    if (error) return NextResponse.json({ error: "Task creation failed" }, { status: 500 });

    await writeAuditLog({
      userId:     user.id,
      action:     "bulk_document_return",
      targetType: "case",
      metadata:   { caseIds, returnReason, count: caseIds.length },
    });

    return NextResponse.json({ success: true, created: caseIds.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
