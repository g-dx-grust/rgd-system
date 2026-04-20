/**
 * 請求管理 リポジトリ
 */

import { createClient } from "@/lib/supabase/server";
import {
  getOptionalFeatureUnavailableMessage,
  isMissingSupabaseColumnError,
} from "@/lib/supabase/errors";

export const INVOICE_STATUS = {
  DRAFT: "draft",
  SENT: "sent",
  PAID: "paid",
  OVERDUE: "overdue",
  CANCELLED: "cancelled",
} as const;

export type InvoiceStatus =
  (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "下書き",
  sent: "送付済み",
  paid: "入金確認済み",
  overdue: "期限超過",
  cancelled: "キャンセル",
};

export interface InvoiceRow {
  id: string;
  caseId: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  dueDate: string | null;
  amount: number | null;
  billingStatus: InvoiceStatus;
  sentAt: string | null;
  paidAt: string | null;
  documentId: string | null;
  filePath: string | null;
  fileName: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceInput {
  caseId: string;
  invoiceNumber: string;
  invoiceDate?: string;
  dueDate?: string;
  amount?: number;
  filePath?: string;
  fileName?: string;
  note?: string;
  createdBy: string;
}

export interface UpdateInvoiceInput {
  invoiceDate?: string;
  dueDate?: string;
  amount?: number;
  billingStatus?: InvoiceStatus;
  sentAt?: string;
  paidAt?: string;
  documentId?: string;
  note?: string;
}

const INVOICE_SELECT_FIELDS = [
  "id",
  "case_id",
  "invoice_number",
  "invoice_date",
  "due_date",
  "amount",
  "billing_status",
  "sent_at",
  "paid_at",
  "document_id",
  "file_path",
  "file_name",
  "note",
  "created_by",
  "created_at",
  "updated_at",
].join(", ");

const LEGACY_INVOICE_SELECT_FIELDS = [
  "id",
  "case_id",
  "invoice_number",
  "invoice_date",
  "due_date",
  "amount",
  "billing_status",
  "sent_at",
  "paid_at",
  "document_id",
  "note",
  "created_by",
  "created_at",
  "updated_at",
].join(", ");

// ---------------------------------------------------------------
// 案件の請求一覧
// ---------------------------------------------------------------
export async function listInvoices(caseId: string): Promise<InvoiceRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT_FIELDS)
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (
    error &&
    isMissingSupabaseColumnError(error, ["file_path", "file_name"])
  ) {
    const { data: legacyData, error: legacyError } = await supabase
      .from("invoices")
      .select(LEGACY_INVOICE_SELECT_FIELDS)
      .eq("case_id", caseId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (legacyError) throw new Error(legacyError.message);
    return ((legacyData ?? []) as unknown as Record<string, unknown>[]).map(
      mapInvoice
    );
  }

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapInvoice);
}

// ---------------------------------------------------------------
// 請求作成
// ---------------------------------------------------------------
export async function createInvoice(
  input: CreateInvoiceInput
): Promise<InvoiceRow> {
  const supabase = await createClient();
  const insertPayload: Record<string, unknown> = {
    case_id: input.caseId,
    invoice_number: input.invoiceNumber,
    invoice_date: input.invoiceDate ?? null,
    due_date: input.dueDate ?? null,
    amount: input.amount ?? null,
    note: input.note ?? null,
    created_by: input.createdBy,
  };

  if (input.filePath !== undefined) insertPayload["file_path"] = input.filePath;
  if (input.fileName !== undefined) insertPayload["file_name"] = input.fileName;

  const { data, error } = await supabase
    .from("invoices")
    .insert(insertPayload)
    .select(INVOICE_SELECT_FIELDS)
    .single();

  if (
    error &&
    isMissingSupabaseColumnError(error, ["file_path", "file_name"])
  ) {
    if (input.filePath !== undefined || input.fileName !== undefined) {
      throw new Error(getOptionalFeatureUnavailableMessage("請求書ファイル"));
    }

    const { data: legacyData, error: legacyError } = await supabase
      .from("invoices")
      .insert({
        case_id: input.caseId,
        invoice_number: input.invoiceNumber,
        invoice_date: input.invoiceDate ?? null,
        due_date: input.dueDate ?? null,
        amount: input.amount ?? null,
        note: input.note ?? null,
        created_by: input.createdBy,
      })
      .select(LEGACY_INVOICE_SELECT_FIELDS)
      .single();

    if (legacyError || !legacyData) {
      throw new Error(legacyError?.message ?? "請求の作成に失敗しました");
    }
    return mapInvoice(legacyData as unknown as Record<string, unknown>);
  }

  if (error || !data)
    throw new Error(error?.message ?? "請求の作成に失敗しました");
  return mapInvoice(data as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------
// 請求ステータス更新
// ---------------------------------------------------------------
export async function updateInvoice(
  id: string,
  input: UpdateInvoiceInput
): Promise<void> {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};
  if (input.invoiceDate !== undefined)
    updates["invoice_date"] = input.invoiceDate;
  if (input.dueDate !== undefined) updates["due_date"] = input.dueDate;
  if (input.amount !== undefined) updates["amount"] = input.amount;
  if (input.billingStatus !== undefined)
    updates["billing_status"] = input.billingStatus;
  if (input.sentAt !== undefined) updates["sent_at"] = input.sentAt;
  if (input.paidAt !== undefined) updates["paid_at"] = input.paidAt;
  if (input.documentId !== undefined) updates["document_id"] = input.documentId;
  if (input.note !== undefined) updates["note"] = input.note;

  const { error } = await supabase
    .from("invoices")
    .update(updates)
    .eq("id", id)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------
// 論理削除
// ---------------------------------------------------------------
export async function deleteInvoice(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------
// 全案件横断：請求一覧
// ---------------------------------------------------------------
export interface InvoiceWithCaseRow extends InvoiceRow {
  caseName: string;
  caseCode: string;
  organizationName: string;
}

export async function listAllInvoices(): Promise<InvoiceWithCaseRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select(
      `id, case_id, invoice_number, invoice_date, due_date, amount, billing_status,
       sent_at, paid_at, document_id, note, created_by, created_at, updated_at,
       cases ( case_name, case_code, organizations ( legal_name ) )`
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => {
    const c = r["cases"] as unknown as Record<string, unknown> | null;
    const org = c?.["organizations"] as unknown as Record<
      string,
      unknown
    > | null;
    return {
      ...mapInvoice(r as Record<string, unknown>),
      caseName: c ? String(c["case_name"]) : "",
      caseCode: c ? String(c["case_code"]) : "",
      organizationName: org ? String(org["legal_name"]) : "",
    };
  });
}

// ---------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------
function mapInvoice(row: Record<string, unknown>): InvoiceRow {
  return {
    id: String(row["id"]),
    caseId: String(row["case_id"]),
    invoiceNumber: String(row["invoice_number"]),
    invoiceDate:
      row["invoice_date"] != null ? String(row["invoice_date"]) : null,
    dueDate: row["due_date"] != null ? String(row["due_date"]) : null,
    amount: row["amount"] != null ? Number(row["amount"]) : null,
    billingStatus: String(row["billing_status"]) as InvoiceStatus,
    sentAt: row["sent_at"] != null ? String(row["sent_at"]) : null,
    paidAt: row["paid_at"] != null ? String(row["paid_at"]) : null,
    documentId: row["document_id"] != null ? String(row["document_id"]) : null,
    filePath: row["file_path"] != null ? String(row["file_path"]) : null,
    fileName: row["file_name"] != null ? String(row["file_name"]) : null,
    note: row["note"] != null ? String(row["note"]) : null,
    createdBy: row["created_by"] != null ? String(row["created_by"]) : null,
    createdAt: String(row["created_at"]),
    updatedAt: String(row["updated_at"]),
  };
}
