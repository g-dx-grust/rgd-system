"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { PERMISSIONS, requirePermission } from "@/lib/rbac";
import { writeAuditLog } from "@/server/repositories/audit-log";
import { createTask, updateTask } from "@/server/repositories/tasks";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

const VALID_TASK_STATUSES = ["open", "in_progress", "done", "skipped"] as const;
const VALID_TASK_PRIORITIES = ["low", "medium", "high", "critical"] as const;

export async function createTaskAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  requirePermission(user.roleCode, PERMISSIONS.TASK_MANAGE);

  const caseId = String(formData.get("caseId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description =
    String(formData.get("description") ?? "").trim() || undefined;
  const priority = String(formData.get("priority") ?? "medium").trim() as
    | "low"
    | "medium"
    | "high"
    | "critical";
  const assigneeUserId =
    String(formData.get("assigneeUserId") ?? "").trim() || undefined;
  const dueDate = String(formData.get("dueDate") ?? "").trim() || undefined;

  if (!caseId) return { error: "案件IDが不正です。" };
  if (!title) return { error: "タスク名を入力してください。" };
  if (!VALID_TASK_PRIORITIES.includes(priority)) {
    return { error: "不正な優先度です。" };
  }

  try {
    const task = await createTask({
      caseId,
      title,
      description,
      priority,
      assigneeUserId,
      dueDate,
    });

    await writeAuditLog({
      userId: user.id,
      action: "case_update",
      targetType: "tasks",
      targetId: task.id,
      metadata: { caseId, title, status: task.status },
    });
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "タスクの作成に失敗しました。",
    };
  }

  revalidateTaskRelatedPaths(caseId);
  return { success: true };
}

export async function updateTaskAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  requirePermission(user.roleCode, PERMISSIONS.TASK_MANAGE);

  const caseId = String(formData.get("caseId") ?? "").trim();
  const taskId = String(formData.get("taskId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim() as
    | "open"
    | "in_progress"
    | "done"
    | "skipped";
  const assigneeRaw = String(formData.get("assigneeUserId") ?? "").trim();
  const dueDateRaw = String(formData.get("dueDate") ?? "").trim();

  if (!caseId || !taskId) return { error: "パラメータが不正です。" };
  if (!VALID_TASK_STATUSES.includes(status)) {
    return { error: "不正なステータスです。" };
  }

  try {
    await updateTask(taskId, {
      status,
      assigneeUserId: assigneeRaw || null,
      dueDate: dueDateRaw || null,
    });

    await writeAuditLog({
      userId: user.id,
      action: "case_update",
      targetType: "tasks",
      targetId: taskId,
      metadata: {
        caseId,
        status,
        assigneeUserId: assigneeRaw || null,
        dueDate: dueDateRaw || null,
      },
    });
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "タスクの更新に失敗しました。",
    };
  }

  revalidateTaskRelatedPaths(caseId);
  return { success: true };
}

function revalidateTaskRelatedPaths(caseId: string) {
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
}
