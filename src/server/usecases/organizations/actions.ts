"use server";

/**
 * 顧客企業 Server Actions
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import {
  createOrganization,
  updateOrganization,
  createContact,
} from "@/server/repositories/organizations";
import { writeAuditLog } from "@/server/repositories/audit-log";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

// ---------------------------------------------------------------
// 企業作成
// ---------------------------------------------------------------
export async function createOrganizationAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  requirePermission(user.roleCode, PERMISSIONS.CLIENT_EDIT);

  const legalName = String(formData.get("legalName") ?? "").trim();
  if (!legalName) return { error: "法人名を入力してください。" };

  let org;
  try {
    org = await createOrganization({
      legalName,
      corporateNumber: String(formData.get("corporateNumber") ?? "").trim() || undefined,
      postalCode:      String(formData.get("postalCode") ?? "").trim() || undefined,
      address:         String(formData.get("address") ?? "").trim() || undefined,
      industry:        String(formData.get("industry") ?? "").trim() || undefined,
      employeeSize:    String(formData.get("employeeSize") ?? "").trim() || undefined,
      notes:           String(formData.get("notes") ?? "").trim() || undefined,
      createdBy:       user.id,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "企業の作成に失敗しました。" };
  }

  await writeAuditLog({
    userId:     user.id,
    action:     "case_create",   // audit_logs の AuditAction に client_create がないため case_create で代用
    targetType: "organizations",
    targetId:   org.id,
    metadata:   { legalName },
  });

  redirect(`/organizations/${org.id}`);
}

// ---------------------------------------------------------------
// 企業更新
// ---------------------------------------------------------------
export async function updateOrganizationAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  requirePermission(user.roleCode, PERMISSIONS.CLIENT_EDIT);

  const orgId    = String(formData.get("orgId") ?? "").trim();
  const legalName = String(formData.get("legalName") ?? "").trim();
  if (!orgId)    return { error: "企業IDが不正です。" };
  if (!legalName) return { error: "法人名を入力してください。" };

  try {
    await updateOrganization(orgId, {
      legalName,
      corporateNumber: String(formData.get("corporateNumber") ?? "").trim() || undefined,
      postalCode:      String(formData.get("postalCode") ?? "").trim() || undefined,
      address:         String(formData.get("address") ?? "").trim() || undefined,
      industry:        String(formData.get("industry") ?? "").trim() || undefined,
      employeeSize:    String(formData.get("employeeSize") ?? "").trim() || undefined,
      notes:           String(formData.get("notes") ?? "").trim() || undefined,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "企業の更新に失敗しました。" };
  }

  await writeAuditLog({
    userId:     user.id,
    action:     "case_update",
    targetType: "organizations",
    targetId:   orgId,
    metadata:   { legalName },
  });

  revalidatePath(`/organizations/${orgId}`);
  return { success: true };
}

// ---------------------------------------------------------------
// 担当者追加
// ---------------------------------------------------------------
export async function createContactAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  requirePermission(user.roleCode, PERMISSIONS.CLIENT_EDIT);

  const organizationId = String(formData.get("organizationId") ?? "").trim();
  const name           = String(formData.get("name") ?? "").trim();
  if (!organizationId) return { error: "企業IDが不正です。" };
  if (!name)           return { error: "担当者名を入力してください。" };

  try {
    await createContact({
      organizationId,
      name,
      department: String(formData.get("department") ?? "").trim() || undefined,
      title:      String(formData.get("title") ?? "").trim() || undefined,
      email:      String(formData.get("email") ?? "").trim() || undefined,
      phone:      String(formData.get("phone") ?? "").trim() || undefined,
      isPrimary:  formData.get("isPrimary") === "true",
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "担当者の追加に失敗しました。" };
  }

  revalidatePath(`/organizations/${organizationId}`);
  return { success: true };
}
