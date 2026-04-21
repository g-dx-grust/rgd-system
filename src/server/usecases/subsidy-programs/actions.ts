"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import {
  createSubsidyProgram,
  deleteSubsidyProgram,
} from "@/server/repositories/subsidy-programs";
import { writeAuditLog } from "@/server/repositories/audit-log";

export interface SubsidyProgramActionResult {
  error?: string;
  success?: boolean;
}

const SETTINGS_PATH = "/settings";
const COURSES_PATH = "/admin/courses";

export async function createSubsidyProgramAction(
  _prevState: SubsidyProgramActionResult | null,
  formData: FormData
): Promise<SubsidyProgramActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) return { error: "認証が必要です。" };

  requirePermission(currentUser.roleCode, PERMISSIONS.USER_MANAGE);

  const name = String(formData.get("name") ?? "").trim();
  const codeRaw = String(formData.get("code") ?? "").trim();
  const abbreviation = String(formData.get("abbreviation") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const sortOrderRaw = String(formData.get("sortOrder") ?? "").trim();

  if (!name) {
    return { error: "助成金名を入力してください。" };
  }

  const sortOrder =
    sortOrderRaw.length > 0 ? Number(sortOrderRaw) : 0;

  if (Number.isNaN(sortOrder)) {
    return { error: "表示順序は数値で入力してください。" };
  }

  const generatedCode =
    codeRaw.length > 0
      ? codeRaw
      : `program_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

  let subsidyProgramId: string;
  try {
    subsidyProgramId = await createSubsidyProgram({
      code: generatedCode,
      name,
      abbreviation,
      description,
      sortOrder,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "助成金種別の作成に失敗しました。";
    if (message.toLowerCase().includes("duplicate") || message.includes("unique")) {
      return { error: "同じ内部コードの助成金種別がすでに存在します。" };
    }
    return { error: message };
  }

  await writeAuditLog({
    userId: currentUser.id,
    action: "subsidy_program_create",
    targetType: "subsidy_program",
    targetId: subsidyProgramId,
    metadata: { name, code: generatedCode, abbreviation },
  });

  revalidatePath(SETTINGS_PATH);
  revalidatePath(COURSES_PATH);
  return { success: true };
}

export async function deleteSubsidyProgramAction(
  _prevState: SubsidyProgramActionResult | null,
  formData: FormData
): Promise<SubsidyProgramActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) return { error: "認証が必要です。" };

  requirePermission(currentUser.roleCode, PERMISSIONS.USER_MANAGE);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    return { error: "助成金種別IDが不正です。" };
  }

  try {
    await deleteSubsidyProgram(id);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "助成金種別の削除に失敗しました。",
    };
  }

  await writeAuditLog({
    userId: currentUser.id,
    action: "subsidy_program_delete",
    targetType: "subsidy_program",
    targetId: id,
  });

  revalidatePath(SETTINGS_PATH);
  revalidatePath(COURSES_PATH);
  return { success: true };
}
