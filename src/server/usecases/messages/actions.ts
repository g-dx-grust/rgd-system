"use server";

/**
 * メッセージテンプレート / 送信履歴 Server Actions
 */

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import {
  recordSentMessage,
  applyPlaceholders,
  listMessageTemplates,
} from "@/server/repositories/message-templates";
import type { TemplateType } from "@/server/repositories/message-templates";
import { getCase } from "@/server/repositories/cases";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

// ---------------------------------------------------------------
// メッセージ送信記録（テンプレート + プレースホルダ差し込み）
// ---------------------------------------------------------------
export async function sendMessageAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  requirePermission(user.roleCode, PERMISSIONS.CASE_EDIT);

  const caseId       = String(formData.get("caseId") ?? "").trim();
  const templateId   = String(formData.get("templateId") ?? "").trim() || undefined;
  const templateType = String(formData.get("templateType") ?? "other").trim() as TemplateType;
  const subject      = String(formData.get("subject") ?? "").trim();
  const body         = String(formData.get("body") ?? "").trim();
  const sentTo       = String(formData.get("sentTo") ?? "").trim() || undefined;
  const sendMethod   = (String(formData.get("sendMethod") ?? "manual").trim() || "manual") as "email" | "manual" | "lark";
  const note         = String(formData.get("note") ?? "").trim() || undefined;

  if (!caseId)   return { error: "案件IDが不正です。" };
  if (!subject)  return { error: "件名を入力してください。" };
  if (!body)     return { error: "本文を入力してください。" };

  try {
    await recordSentMessage({
      caseId,
      templateId,
      templateType,
      subject,
      body,
      sentTo,
      sentBy: user.id,
      sendMethod,
      note,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "送信履歴の記録に失敗しました。" };
  }

  revalidatePath(`/cases/${caseId}/messages`);
  return { success: true };
}

// ---------------------------------------------------------------
// テンプレートから差し込み済み本文を生成して返す
// （Route Handler ではなく usecase として提供）
// ---------------------------------------------------------------
export async function previewMessageAction(
  _prev: { subject: string; body: string } | null,
  formData: FormData
): Promise<{ subject: string; body: string } | { error: string }> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  const caseId     = String(formData.get("caseId") ?? "").trim();
  const templateId = String(formData.get("templateId") ?? "").trim();

  if (!caseId || !templateId) return { error: "パラメータが不正です。" };

  // 案件情報を取得
  const caseData = await getCase(caseId);
  if (!caseData) return { error: "案件が見つかりません。" };

  // 顧客担当者（主担当）を取得
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from("organization_contacts")
    .select("name")
    .eq("organization_id", caseData.organizationId)
    .eq("is_primary", true)
    .is("deleted_at", null)
    .maybeSingle();

  // テンプレートを取得
  const templates = await listMessageTemplates();
  const template = templates.find((t) => t.id === templateId);
  if (!template) return { error: "テンプレートが見つかりません。" };

  const placeholders = {
    company_name:        caseData.organizationName,
    case_name:           caseData.caseName,
    contact_name:        (contacts as { name?: string } | null)?.name ?? "",
    acceptance_date:     caseData.acceptanceDate ?? "",
    training_start_date: caseData.plannedStartDate ?? "",
    training_end_date:   caseData.plannedEndDate ?? "",
  };

  return {
    subject: applyPlaceholders(template.subject, placeholders),
    body:    applyPlaceholders(template.body, placeholders),
  };
}
