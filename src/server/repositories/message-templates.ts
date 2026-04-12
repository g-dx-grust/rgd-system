/**
 * メッセージテンプレート / 送信履歴 リポジトリ
 */

import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function fetchSenderNameMap(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const { data } = await supabase
    .from("user_profiles")
    .select("id, display_name")
    .in("id", userIds);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row["id"] && row["display_name"]) {
      map.set(String(row["id"]), String(row["display_name"]));
    }
  }
  return map;
}

export const TEMPLATE_TYPE = {
  START_GUIDE:     'start_guide',
  BILLING_NOTICE:  'billing_notice',
  DOC_REQUEST:     'doc_request',
  QUESTIONNAIRE:   'questionnaire',
  REMINDER:        'reminder',
  OTHER:           'other',
} as const;

export type TemplateType = typeof TEMPLATE_TYPE[keyof typeof TEMPLATE_TYPE];

export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  start_guide:    '開始案内',
  billing_notice: '請求書送付案内',
  doc_request:    '書類依頼',
  questionnaire:  'アンケート依頼',
  reminder:       'リマインド',
  other:          'その他',
};

export interface MessageTemplateRow {
  id:           string;
  templateType: TemplateType;
  name:         string;
  subject:      string;
  body:         string;
  active:       boolean;
  createdAt:    string;
  updatedAt:    string;
}

export interface SentMessageRow {
  id:           string;
  caseId:       string;
  templateId:   string | null;
  templateType: string;
  subject:      string;
  body:         string;
  sentTo:       string | null;
  sentBy:       string | null;
  sentByName:   string | null;
  sentAt:       string;
  sendMethod:   string;
  note:         string | null;
  createdAt:    string;
}

export interface CreateMessageTemplateInput {
  templateType: TemplateType;
  name:         string;
  subject:      string;
  body:         string;
  createdBy:    string;
}

export interface RecordSentMessageInput {
  caseId:       string;
  templateId?:  string;
  templateType: string;
  subject:      string;
  body:         string;
  sentTo?:      string;
  sentBy:       string;
  sendMethod?:  'email' | 'manual' | 'lark';
  note?:        string;
}

// ---------------------------------------------------------------
// テンプレート一覧
// ---------------------------------------------------------------
export async function listMessageTemplates(templateType?: TemplateType): Promise<MessageTemplateRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("message_templates")
    .select("id, template_type, name, subject, body, active, created_at, updated_at")
    .is("deleted_at", null)
    .eq("active", true)
    .order("template_type")
    .order("name");

  if (templateType) {
    query = query.eq("template_type", templateType);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapTemplate);
}

// ---------------------------------------------------------------
// テンプレート作成
// ---------------------------------------------------------------
export async function createMessageTemplate(input: CreateMessageTemplateInput): Promise<MessageTemplateRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("message_templates")
    .insert({
      template_type: input.templateType,
      name:          input.name,
      subject:       input.subject,
      body:          input.body,
      created_by:    input.createdBy,
    })
    .select("id, template_type, name, subject, body, active, created_at, updated_at")
    .single();

  if (error || !data) throw new Error(error?.message ?? "テンプレートの作成に失敗しました");
  return mapTemplate(data);
}

// ---------------------------------------------------------------
// 案件の送信履歴
// ---------------------------------------------------------------
export async function listSentMessages(caseId: string): Promise<SentMessageRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sent_messages")
    .select(`
      id, case_id, template_id, template_type, subject, body,
      sent_to, sent_by, sent_at, send_method, note, created_at
    `)
    .eq("case_id", caseId)
    .order("sent_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const senderIds = [...new Set(
    rows.map((r) => r["sent_by"]).filter((id): id is string => !!id)
  )];
  const nameMap = senderIds.length > 0
    ? await fetchSenderNameMap(supabase, senderIds)
    : new Map<string, string>();
  return rows.map((r) => mapSentMessage(r, nameMap));
}

// ---------------------------------------------------------------
// 送信履歴を記録
// ---------------------------------------------------------------
export async function recordSentMessage(input: RecordSentMessageInput): Promise<SentMessageRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sent_messages")
    .insert({
      case_id:       input.caseId,
      template_id:   input.templateId ?? null,
      template_type: input.templateType,
      subject:       input.subject,
      body:          input.body,
      sent_to:       input.sentTo ?? null,
      sent_by:       input.sentBy,
      send_method:   input.sendMethod ?? "manual",
      note:          input.note ?? null,
    })
    .select(`
      id, case_id, template_id, template_type, subject, body,
      sent_to, sent_by, sent_at, send_method, note, created_at
    `)
    .single();

  if (error || !data) throw new Error(error?.message ?? "送信履歴の記録に失敗しました");
  const nameMap = data["sent_by"]
    ? await fetchSenderNameMap(supabase, [String(data["sent_by"])])
    : new Map<string, string>();
  return mapSentMessage(data, nameMap);
}

// ---------------------------------------------------------------
// プレースホルダ差し込み
// ---------------------------------------------------------------
export interface MessagePlaceholders {
  company_name?:       string;
  case_name?:          string;
  contact_name?:       string;
  acceptance_date?:    string;
  training_start_date?: string;
  training_end_date?:  string;
  due_date?:           string;
  invoice_number?:     string;
  invoice_date?:       string;
  missing_documents?:  string;
}

export function applyPlaceholders(text: string, placeholders: MessagePlaceholders): string {
  const replacements: Record<string, string> = {};

  if (placeholders.company_name       != null) replacements["{{company_name}}"]        = placeholders.company_name;
  if (placeholders.case_name          != null) replacements["{{case_name}}"]           = placeholders.case_name;
  if (placeholders.contact_name       != null) replacements["{{contact_name}}"]        = placeholders.contact_name;
  if (placeholders.acceptance_date    != null) replacements["{{acceptance_date}}"]     = placeholders.acceptance_date;
  if (placeholders.training_start_date != null) replacements["{{training_start_date}}"] = placeholders.training_start_date;
  if (placeholders.training_end_date  != null) replacements["{{training_end_date}}"]   = placeholders.training_end_date;
  if (placeholders.due_date           != null) replacements["{{due_date}}"]            = placeholders.due_date;
  if (placeholders.invoice_number     != null) replacements["{{invoice_number}}"]      = placeholders.invoice_number;
  if (placeholders.invoice_date       != null) replacements["{{invoice_date}}"]        = placeholders.invoice_date;
  if (placeholders.missing_documents  != null) replacements["{{missing_documents}}"]   = placeholders.missing_documents;

  return Object.entries(replacements).reduce(
    (result, [key, value]) => result.replaceAll(key, value),
    text
  );
}

// ---------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------
function mapTemplate(row: Record<string, unknown>): MessageTemplateRow {
  return {
    id:           String(row["id"]),
    templateType: String(row["template_type"]) as TemplateType,
    name:         String(row["name"]),
    subject:      String(row["subject"]),
    body:         String(row["body"]),
    active:       Boolean(row["active"]),
    createdAt:    String(row["created_at"]),
    updatedAt:    String(row["updated_at"]),
  };
}

function mapSentMessage(row: Record<string, unknown>, nameMap?: Map<string, string>): SentMessageRow {
  const sentBy = row["sent_by"] != null ? String(row["sent_by"]) : null;
  return {
    id:           String(row["id"]),
    caseId:       String(row["case_id"]),
    templateId:   row["template_id"] != null ? String(row["template_id"]) : null,
    templateType: String(row["template_type"]),
    subject:      String(row["subject"]),
    body:         String(row["body"]),
    sentTo:       row["sent_to"] != null ? String(row["sent_to"]) : null,
    sentBy,
    sentByName:   sentBy && nameMap ? (nameMap.get(sentBy) ?? null) : null,
    sentAt:       String(row["sent_at"]),
    sendMethod:   String(row["send_method"]),
    note:         row["note"] != null ? String(row["note"]) : null,
    createdAt:    String(row["created_at"]),
  };
}
