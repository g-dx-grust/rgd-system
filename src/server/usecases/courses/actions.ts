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
} from "@/server/repositories/video-courses";
import { writeAuditLog } from "@/server/repositories/audit-log";

export interface CourseActionResult {
  error?: string;
  success?: boolean;
}

const COURSES_PATH = "/admin/courses";
const SETTINGS_PATH = "/settings";

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

  const courseId = await createVideoCourse({
    name: name.trim(),
    subsidyProgramId:
      typeof subsidyProgramId === "string" && subsidyProgramId.trim()
        ? subsidyProgramId.trim()
        : null,
    code:
      typeof code === "string" && code.trim() ? code.trim() : null,
    displayTemplate:
      typeof displayTemplate === "string" && displayTemplate.trim()
        ? displayTemplate.trim()
        : null,
    description:
      typeof description === "string" && description.trim()
        ? description.trim()
        : null,
    displayOrder,
  });

  await writeAuditLog({
    userId: currentUser.id,
    action: "course_create",
    targetType: "video_course",
    targetId: courseId,
    metadata: { name, subsidyProgramId, code },
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

  await updateVideoCourse(id.trim(), {
    name: name.trim(),
    subsidyProgramId:
      typeof subsidyProgramId === "string" && subsidyProgramId.trim()
        ? subsidyProgramId.trim()
        : null,
    code:
      typeof code === "string" && code.trim() ? code.trim() : null,
    displayTemplate:
      typeof displayTemplate === "string" && displayTemplate.trim()
        ? displayTemplate.trim()
        : null,
    description:
      typeof description === "string" && description.trim()
        ? description.trim()
        : null,
    displayOrder,
  });

  await writeAuditLog({
    userId: currentUser.id,
    action: "course_update",
    targetType: "video_course",
    targetId: id.trim(),
    metadata: { name, subsidyProgramId, code },
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

  const id = formData.get("id");

  if (typeof id !== "string" || !id.trim()) {
    return { error: "コースIDが不正です。" };
  }

  await deactivateVideoCourse(id.trim());

  await writeAuditLog({
    userId: currentUser.id,
    action: "course_deactivate",
    targetType: "video_course",
    targetId: id.trim(),
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

  const id = formData.get("id");

  if (typeof id !== "string" || !id.trim()) {
    return { error: "コースIDが不正です。" };
  }

  await activateVideoCourse(id.trim());

  await writeAuditLog({
    userId: currentUser.id,
    action: "course_activate",
    targetType: "video_course",
    targetId: id.trim(),
  });

  revalidatePath(COURSES_PATH);
  revalidatePath(SETTINGS_PATH);
  return { success: true };
}
