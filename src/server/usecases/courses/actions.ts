"use server";

/**
 * コースマスタ管理 Server Actions
 *
 * Admin ロールのみ実行可。サーバー側で権限チェックを行う。
 */

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import {
  createVideoCourse,
  updateVideoCourse,
  deactivateVideoCourse,
  activateVideoCourse,
  deleteVideoCourse,
  isVideoCoursesFeatureAvailable,
} from "@/server/repositories/video-courses";
import { writeAuditLog } from "@/server/repositories/audit-log";
import { getOptionalFeatureUnavailableMessage } from "@/lib/supabase/errors";

export interface CourseActionResult {
  error?: string;
  success?: boolean;
}

const COURSES_PATH = "/admin/courses";
const SETTINGS_PATH = "/settings";

function getCourseActionErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("duplicate") || normalizedMessage.includes("unique")) {
    return "同じ略称のコースがすでに存在します。";
  }

  if (normalizedMessage.includes("foreign key")) {
    return "選択した助成金種別が見つかりません。画面を再読み込みして再度お試しください。";
  }

  if (
    normalizedMessage.includes("row-level security") ||
    normalizedMessage.includes("permission denied")
  ) {
    return "コースマスタを更新する権限がありません。管理者権限で再度お試しください。";
  }

  if (
    normalizedMessage.includes("display_template") ||
    normalizedMessage.includes("subsidy_program_id") ||
    normalizedMessage.includes("video_courses")
  ) {
    return "コースマスタ機能のデータベース反映が未完了です。migration 適用後に再度お試しください。";
  }

  return message;
}

/**
 * コースを新規作成する
 */
export async function createCourseAction(
  _prevState: CourseActionResult | null,
  formData: FormData
): Promise<CourseActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) return { error: "認証が必要です。" };

  requirePermission(currentUser.roleCode, PERMISSIONS.USER_MANAGE);

  if (!(await isVideoCoursesFeatureAvailable())) {
    return { error: getOptionalFeatureUnavailableMessage("コースマスタ") };
  }

  const name = formData.get("name");
  const subsidyProgramId = formData.get("subsidyProgramId");
  const code = formData.get("code");
  const displayTemplate = formData.get("displayTemplate");
  const description = formData.get("description");
  const displayOrderRaw = formData.get("displayOrder");

  if (typeof name !== "string" || !name.trim()) {
    return { error: "コース名は必須です。" };
  }

  const displayOrder =
    typeof displayOrderRaw === "string" && displayOrderRaw.trim() !== ""
      ? Number(displayOrderRaw)
      : 0;

  if (isNaN(displayOrder)) {
    return { error: "表示順序は数値で入力してください。" };
  }

  const normalizedName = name.trim();
  const normalizedSubsidyProgramId =
    typeof subsidyProgramId === "string" && subsidyProgramId.trim()
      ? subsidyProgramId.trim()
      : null;
  const normalizedCode =
    typeof code === "string" && code.trim() ? code.trim() : null;
  const normalizedDisplayTemplate =
    typeof displayTemplate === "string" && displayTemplate.trim()
      ? displayTemplate.trim()
      : null;
  const normalizedDescription =
    typeof description === "string" && description.trim()
      ? description.trim()
      : null;

  let courseId: string;
  try {
    courseId = await createVideoCourse({
      name: normalizedName,
      subsidyProgramId: normalizedSubsidyProgramId,
      code: normalizedCode,
      displayTemplate: normalizedDisplayTemplate,
      description: normalizedDescription,
      displayOrder,
    });
  } catch (error) {
    return {
      error: getCourseActionErrorMessage(error, "コースの作成に失敗しました。"),
    };
  }

  await writeAuditLog({
    userId: currentUser.id,
    action: "course_create",
    targetType: "video_course",
    targetId: courseId,
    metadata: {
      name: normalizedName,
      subsidyProgramId: normalizedSubsidyProgramId,
      code: normalizedCode,
    },
  });

  revalidatePath(COURSES_PATH);
  revalidatePath(SETTINGS_PATH);
  return { success: true };
}

/**
 * コースを編集する
 */
export async function updateCourseAction(
  _prevState: CourseActionResult | null,
  formData: FormData
): Promise<CourseActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) return { error: "認証が必要です。" };

  requirePermission(currentUser.roleCode, PERMISSIONS.USER_MANAGE);

  if (!(await isVideoCoursesFeatureAvailable())) {
    return { error: getOptionalFeatureUnavailableMessage("コースマスタ") };
  }

  const id = formData.get("id");
  const name = formData.get("name");
  const subsidyProgramId = formData.get("subsidyProgramId");
  const code = formData.get("code");
  const displayTemplate = formData.get("displayTemplate");
  const description = formData.get("description");
  const displayOrderRaw = formData.get("displayOrder");

  if (typeof id !== "string" || !id.trim()) {
    return { error: "コースIDが不正です。" };
  }
  if (typeof name !== "string" || !name.trim()) {
    return { error: "コース名は必須です。" };
  }

  const displayOrder =
    typeof displayOrderRaw === "string" && displayOrderRaw.trim() !== ""
      ? Number(displayOrderRaw)
      : 0;

  if (isNaN(displayOrder)) {
    return { error: "表示順序は数値で入力してください。" };
  }

  const normalizedId = id.trim();
  const normalizedName = name.trim();
  const normalizedSubsidyProgramId =
    typeof subsidyProgramId === "string" && subsidyProgramId.trim()
      ? subsidyProgramId.trim()
      : null;
  const normalizedCode =
    typeof code === "string" && code.trim() ? code.trim() : null;
  const normalizedDisplayTemplate =
    typeof displayTemplate === "string" && displayTemplate.trim()
      ? displayTemplate.trim()
      : null;
  const normalizedDescription =
    typeof description === "string" && description.trim()
      ? description.trim()
      : null;

  try {
    await updateVideoCourse(normalizedId, {
      name: normalizedName,
      subsidyProgramId: normalizedSubsidyProgramId,
      code: normalizedCode,
      displayTemplate: normalizedDisplayTemplate,
      description: normalizedDescription,
      displayOrder,
    });
  } catch (error) {
    return {
      error: getCourseActionErrorMessage(error, "コースの更新に失敗しました。"),
    };
  }

  await writeAuditLog({
    userId: currentUser.id,
    action: "course_update",
    targetType: "video_course",
    targetId: normalizedId,
    metadata: {
      name: normalizedName,
      subsidyProgramId: normalizedSubsidyProgramId,
      code: normalizedCode,
    },
  });

  revalidatePath(COURSES_PATH);
  revalidatePath(SETTINGS_PATH);
  return { success: true };
}

/**
 * コースを無効化する（論理削除）
 */
export async function deactivateCourseAction(
  _prevState: CourseActionResult | null,
  formData: FormData
): Promise<CourseActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) return { error: "認証が必要です。" };

  requirePermission(currentUser.roleCode, PERMISSIONS.USER_MANAGE);

  if (!(await isVideoCoursesFeatureAvailable())) {
    return { error: getOptionalFeatureUnavailableMessage("コースマスタ") };
  }

  const id = formData.get("id");

  if (typeof id !== "string" || !id.trim()) {
    return { error: "コースIDが不正です。" };
  }

  const normalizedId = id.trim();

  try {
    await deactivateVideoCourse(normalizedId);
  } catch (error) {
    return {
      error: getCourseActionErrorMessage(error, "コースの停止に失敗しました。"),
    };
  }

  await writeAuditLog({
    userId: currentUser.id,
    action: "course_deactivate",
    targetType: "video_course",
    targetId: normalizedId,
  });

  revalidatePath(COURSES_PATH);
  revalidatePath(SETTINGS_PATH);
  return { success: true };
}

/**
 * コースを有効化する
 */
export async function activateCourseAction(
  _prevState: CourseActionResult | null,
  formData: FormData
): Promise<CourseActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) return { error: "認証が必要です。" };

  requirePermission(currentUser.roleCode, PERMISSIONS.USER_MANAGE);

  if (!(await isVideoCoursesFeatureAvailable())) {
    return { error: getOptionalFeatureUnavailableMessage("コースマスタ") };
  }

  const id = formData.get("id");

  if (typeof id !== "string" || !id.trim()) {
    return { error: "コースIDが不正です。" };
  }

  const normalizedId = id.trim();

  try {
    await activateVideoCourse(normalizedId);
  } catch (error) {
    return {
      error: getCourseActionErrorMessage(error, "コースの有効化に失敗しました。"),
    };
  }

  await writeAuditLog({
    userId: currentUser.id,
    action: "course_activate",
    targetType: "video_course",
    targetId: normalizedId,
  });

  revalidatePath(COURSES_PATH);
  revalidatePath(SETTINGS_PATH);
  return { success: true };
}

export async function deleteCourseAction(
  _prevState: CourseActionResult | null,
  formData: FormData
): Promise<CourseActionResult> {
  const currentUser = await getCurrentUserProfile();
  if (!currentUser) return { error: "認証が必要です。" };

  requirePermission(currentUser.roleCode, PERMISSIONS.USER_MANAGE);

  if (!(await isVideoCoursesFeatureAvailable())) {
    return { error: getOptionalFeatureUnavailableMessage("コースマスタ") };
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id.trim()) {
    return { error: "コースIDが不正です。" };
  }

  const normalizedId = id.trim();

  try {
    await deleteVideoCourse(normalizedId);
  } catch (error) {
    return {
      error: getCourseActionErrorMessage(error, "コースの削除に失敗しました。"),
    };
  }

  await writeAuditLog({
    userId: currentUser.id,
    action: "course_delete",
    targetType: "video_course",
    targetId: normalizedId,
  });

  revalidatePath(COURSES_PATH);
  revalidatePath(SETTINGS_PATH);
  return { success: true };
}
