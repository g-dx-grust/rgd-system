"use server";

/**
 * 請求管理 Server Actions
 */

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import { createInvoice, updateInvoice, deleteInvoice } from "@/server/repositories/invoices";
import type { InvoiceStatus } from "@/server/repositories/invoices";
import { writeAuditLog } from "@/server/repositories/audit-log";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

// ---------------------------------------------------------------
// 請求作成
// ---------------------------------------------------------------
export async function createInvoiceAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  requirePermission(user.roleCode, PERMISSIONS.BILLING_REGISTER);

  const caseId        = String(formData.get("caseId") ?? "").trim();
  const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim();
  const invoiceDate   = String(formData.get("invoiceDate") ?? "").trim() || undefined;
  const dueDate       = String(formData.get("dueDate") ?? "").trim() || undefined;
  const amountStr     = String(formData.get("amount") ?? "").trim();
  const amount        = amountStr ? Number(amountStr) : undefined;
  const note          = String(formData.get("note") ?? "").trim() || undefined;

  if (!caseId)        return { error: "案件IDが不正です。" };
  if (!invoiceNumber) return { error: "請求番号を入力してください。" };
  if (amount !== undefined && isNaN(amount)) return { error: "金額の形式が正しくありません。" };

  try {
    const invoice = await createInvoice({ caseId, invoiceNumber, invoiceDate, dueDate, amount, note, createdBy: user.id });

    await writeAuditLog({
      userId:     user.id,
      action:     "billing_status_change",
      targetType: "invoices",
      targetId:   invoice.id,
      metadata:   { invoiceNumber, caseId, action: "created" },
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "請求の作成に失敗しました。" };
  }

  revalidatePath(`/cases/${caseId}/billing`);
  return { success: true };
}

// ---------------------------------------------------------------
// 請求ステータス変更
// ---------------------------------------------------------------
export async function updateInvoiceStatusAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  requirePermission(user.roleCode, PERMISSIONS.BILLING_REGISTER);

  const caseId        = String(formData.get("caseId") ?? "").trim();
  const invoiceId     = String(formData.get("invoiceId") ?? "").trim();
  const billingStatus = String(formData.get("billingStatus") ?? "").trim() as InvoiceStatus;

  if (!caseId || !invoiceId || !billingStatus) return { error: "パラメータが不正です。" };

  const validStatuses: InvoiceStatus[] = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
  if (!validStatuses.includes(billingStatus)) return { error: "不正なステータスです。" };

  const updates: Parameters<typeof updateInvoice>[1] = { billingStatus };

  // 送付済みにする場合は sent_at を設定
  if (billingStatus === "sent") {
    updates.sentAt = new Date().toISOString();
  }
  // 入金確認済みにする場合は paid_at を設定
  if (billingStatus === "paid") {
    updates.paidAt = new Date().toISOString();
  }

  try {
    await updateInvoice(invoiceId, updates);

    await writeAuditLog({
      userId:     user.id,
      action:     "billing_status_change",
      targetType: "invoices",
      targetId:   invoiceId,
      metadata:   { billingStatus, caseId },
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "請求ステータスの変更に失敗しました。" };
  }

  revalidatePath(`/cases/${caseId}/billing`);
  return { success: true };
}

// ---------------------------------------------------------------
// 請求削除（論理削除）
// ---------------------------------------------------------------
export async function deleteInvoiceAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  requirePermission(user.roleCode, PERMISSIONS.BILLING_REGISTER);

  const caseId    = String(formData.get("caseId") ?? "").trim();
  const invoiceId = String(formData.get("invoiceId") ?? "").trim();

  if (!caseId || !invoiceId) return { error: "パラメータが不正です。" };

  try {
    await deleteInvoice(invoiceId);

    await writeAuditLog({
      userId:     user.id,
      action:     "billing_status_change",
      targetType: "invoices",
      targetId:   invoiceId,
      metadata:   { caseId, action: "deleted" },
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "請求の削除に失敗しました。" };
  }

  revalidatePath(`/cases/${caseId}/billing`);
  return { success: true };
}
