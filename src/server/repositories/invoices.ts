/**
 * 請求管理 リポジトリ
 */

import { createClient } from "@/lib/supabase/server";

export const INVOICE_STATUS = {
  DRAFT:     'draft',
  SENT:      'sent',
  PAID:      'paid',
  OVERDUE:   'overdue',
  CANCELLED: 'cancelled',
} as const;

export type InvoiceStatus = typeof INVOICE_STATUS[keyof typeof INVOICE_STATUS];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft:     '下書き',
  sent:      '送付済み',
  paid:      '入金確認済み',
  overdue:   '期限超過',
  cancelled: 'キャンセル',
};

export interface InvoiceRow {
  id:            string;
  caseId:        string;
  invoiceNumber: string;
  invoiceDate:   string | null;
  dueDate:       string | null;
  amount:        number | null;
  billingStatus: InvoiceStatus;
  sentAt:        string | null;
  paidAt:        string | null;
  documentId:    string | null;
  note:          string | null;
  createdBy:     string | null;
  createdAt:     string;
  updatedAt:     string;
}

export interface CreateInvoiceInput {
  caseId:        string;
  invoiceNumber: string;
  invoiceDate?:  string;
  dueDate?:      string;
  amount?:       number;
  note?:         string;
  createdBy:     string;
}

export interface UpdateInvoiceInput {
  invoiceDate?:    string;
  dueDate?:        string;
  amount?:         number;
  billingStatus?:  InvoiceStatus;
  sentAt?:         string;
  paidAt?:         string;
  documentId?:     string;
  note?:           string;
}

// ---------------------------------------------------------------
// 案件の請求一覧
// ---------------------------------------------------------------
export async function listInvoices(caseId: string): Promise<InvoiceRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select("id, case_id, invoice_number, invoice_date, due_date, amount, billing_status, sent_at, paid_at, document_id, note, created_by, created_at, updated_at")
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapInvoice);
}

// ---------------------------------------------------------------
// 請求作成
// ---------------------------------------------------------------
export async function createInvoice(input: CreateInvoiceInput): Promise<InvoiceRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      case_id:        input.caseId,
      invoice_number: input.invoiceNumber,
      invoice_date:   input.invoiceDate ?? null,
      due_date:       input.dueDate ?? null,
      amount:         input.amount ?? null,
      note:           input.note ?? null,
      created_by:     input.createdBy,
    })
    .select("id, case_id, invoice_number, invoice_date, due_date, amount, billing_status, sent_at, paid_at, document_id, note, created_by, created_at, updated_at")
    .single();

  if (error || !data) throw new Error(error?.message ?? "請求の作成に失敗しました");
  return mapInvoice(data);
}

// ---------------------------------------------------------------
// 請求ステータス更新
// ---------------------------------------------------------------
export async function updateInvoice(id: string, input: UpdateInvoiceInput): Promise<void> {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};
  if (input.invoiceDate   !== undefined) updates["invoice_date"]   = input.invoiceDate;
  if (input.dueDate       !== undefined) updates["due_date"]       = input.dueDate;
  if (input.amount        !== undefined) updates["amount"]         = input.amount;
  if (input.billingStatus !== undefined) updates["billing_status"] = input.billingStatus;
  if (input.sentAt        !== undefined) updates["sent_at"]        = input.sentAt;
  if (input.paidAt        !== undefined) updates["paid_at"]        = input.paidAt;
  if (input.documentId    !== undefined) updates["document_id"]    = input.documentId;
  if (input.note          !== undefined) updates["note"]           = input.note;

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
  caseName:         string;
  caseCode:         string;
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

  return (data ?? []).map((r) => {
    const c   = (r["cases"]   as unknown) as Record<string, unknown> | null;
    const org = (c?.["organizations"] as unknown) as Record<string, unknown> | null;
    return {
      ...mapInvoice(r as Record<string, unknown>),
      caseName:         c   ? String(c["case_name"])    : "",
      caseCode:         c   ? String(c["case_code"])    : "",
      organizationName: org ? String(org["legal_name"]) : "",
    };
  });
}

// ---------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------
function mapInvoice(row: Record<string, unknown>): InvoiceRow {
  return {
    id:            String(row["id"]),
    caseId:        String(row["case_id"]),
    invoiceNumber: String(row["invoice_number"]),
    invoiceDate:   row["invoice_date"] != null ? String(row["invoice_date"]) : null,
    dueDate:       row["due_date"]     != null ? String(row["due_date"])     : null,
    amount:        row["amount"]       != null ? Number(row["amount"])       : null,
    billingStatus: String(row["billing_status"]) as InvoiceStatus,
    sentAt:        row["sent_at"]      != null ? String(row["sent_at"])      : null,
    paidAt:        row["paid_at"]      != null ? String(row["paid_at"])      : null,
    documentId:    row["document_id"]  != null ? String(row["document_id"])  : null,
    note:          row["note"]         != null ? String(row["note"])         : null,
    createdBy:     row["created_by"]   != null ? String(row["created_by"])   : null,
    createdAt:     String(row["created_at"]),
    updatedAt:     String(row["updated_at"]),
  };
}
