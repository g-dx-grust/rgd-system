/**
 * 証憑管理 リポジトリ
 */

import { createClient } from "@/lib/supabase/server";

export const EVIDENCE_TYPE = {
  RECEIPT:    'receipt',
  PAYSLIP:    'payslip',
  ATTENDANCE: 'attendance',
  COMPLETION: 'completion',
  OTHER:      'other',
} as const;

export type EvidenceType = typeof EVIDENCE_TYPE[keyof typeof EVIDENCE_TYPE];

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  receipt:    '領収書・振込明細',
  payslip:    '給与明細',
  attendance: '出勤記録・タイムカード',
  completion: '修了証',
  other:      'その他',
};

export const EVIDENCE_STATUS = {
  PENDING:      'pending',
  COLLECTED:    'collected',
  INSUFFICIENT: 'insufficient',
  CONFIRMED:    'confirmed',
} as const;

export type EvidenceStatus = typeof EVIDENCE_STATUS[keyof typeof EVIDENCE_STATUS];

export const EVIDENCE_STATUS_LABELS: Record<EvidenceStatus, string> = {
  pending:      '依頼中',
  collected:    '回収済み',
  insufficient: '不足・不備',
  confirmed:    '確認済み',
};

export interface EvidenceItemRow {
  id:             string;
  caseId:         string;
  participantId:  string | null;
  participantName: string | null;
  evidenceType:   EvidenceType;
  title:          string;
  status:         EvidenceStatus;
  dueDate:        string | null;
  documentId:     string | null;
  requestedAt:    string | null;
  collectedAt:    string | null;
  confirmedAt:    string | null;
  note:           string | null;
  createdAt:      string;
  updatedAt:      string;
}

export interface CreateEvidenceItemInput {
  caseId:        string;
  participantId?: string;
  evidenceType:  EvidenceType;
  title:         string;
  dueDate?:      string;
  note?:         string;
  createdBy:     string;
}

export interface UpdateEvidenceItemInput {
  status?:       EvidenceStatus;
  dueDate?:      string;
  documentId?:   string;
  requestedAt?:  string;
  collectedAt?:  string;
  confirmedAt?:  string;
  note?:         string;
}

// ---------------------------------------------------------------
// 案件の証憑一覧
// ---------------------------------------------------------------
export async function listEvidenceItems(caseId: string): Promise<EvidenceItemRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("evidence_items")
    .select(`
      id, case_id, participant_id, evidence_type, title, status,
      due_date, document_id, requested_at, collected_at, confirmed_at,
      note, created_at, updated_at,
      participant:participants!evidence_items_participant_id_fkey ( name )
    `)
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapEvidence);
}

// ---------------------------------------------------------------
// 証憑作成
// ---------------------------------------------------------------
export async function createEvidenceItem(input: CreateEvidenceItemInput): Promise<EvidenceItemRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("evidence_items")
    .insert({
      case_id:       input.caseId,
      participant_id: input.participantId ?? null,
      evidence_type: input.evidenceType,
      title:         input.title,
      due_date:      input.dueDate ?? null,
      note:          input.note ?? null,
      created_by:    input.createdBy,
    })
    .select(`
      id, case_id, participant_id, evidence_type, title, status,
      due_date, document_id, requested_at, collected_at, confirmed_at,
      note, created_at, updated_at,
      participant:participants!evidence_items_participant_id_fkey ( name )
    `)
    .single();

  if (error || !data) throw new Error(error?.message ?? "証憑の作成に失敗しました");
  return mapEvidence(data);
}

// ---------------------------------------------------------------
// 一括作成（受理後の自動展開用）
// ---------------------------------------------------------------
export async function bulkCreateEvidenceItems(inputs: CreateEvidenceItemInput[]): Promise<void> {
  const supabase = await createClient();

  const inserts = inputs.map((input) => ({
    case_id:       input.caseId,
    participant_id: input.participantId ?? null,
    evidence_type: input.evidenceType,
    title:         input.title,
    due_date:      input.dueDate ?? null,
    note:          input.note ?? null,
    created_by:    input.createdBy,
  }));

  const { error } = await supabase.from("evidence_items").insert(inserts);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------
// 証憑更新
// ---------------------------------------------------------------
export async function updateEvidenceItem(id: string, input: UpdateEvidenceItemInput): Promise<void> {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};
  if (input.status      !== undefined) updates["status"]       = input.status;
  if (input.dueDate     !== undefined) updates["due_date"]     = input.dueDate;
  if (input.documentId  !== undefined) updates["document_id"]  = input.documentId;
  if (input.requestedAt !== undefined) updates["requested_at"] = input.requestedAt;
  if (input.collectedAt !== undefined) updates["collected_at"] = input.collectedAt;
  if (input.confirmedAt !== undefined) updates["confirmed_at"] = input.confirmedAt;
  if (input.note        !== undefined) updates["note"]         = input.note;

  const { error } = await supabase
    .from("evidence_items")
    .update(updates)
    .eq("id", id)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------
// 論理削除
// ---------------------------------------------------------------
export async function deleteEvidenceItem(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("evidence_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------
// 案件の証憑充足サマリー
// ---------------------------------------------------------------
export interface EvidenceSummary {
  total:       number;
  pending:     number;
  collected:   number;
  insufficient: number;
  confirmed:   number;
}

export async function getEvidenceSummary(caseId: string): Promise<EvidenceSummary> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("evidence_items")
    .select("status")
    .eq("case_id", caseId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  const items = data ?? [];
  return {
    total:        items.length,
    pending:      items.filter((r) => r.status === "pending").length,
    collected:    items.filter((r) => r.status === "collected").length,
    insufficient: items.filter((r) => r.status === "insufficient").length,
    confirmed:    items.filter((r) => r.status === "confirmed").length,
  };
}

// ---------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------
function mapEvidence(row: Record<string, unknown>): EvidenceItemRow {
  const participant = row["participant"];
  return {
    id:              String(row["id"]),
    caseId:          String(row["case_id"]),
    participantId:   row["participant_id"] != null ? String(row["participant_id"]) : null,
    participantName: participant && typeof participant === "object" && "name" in participant
      ? String((participant as Record<string, unknown>)["name"]) : null,
    evidenceType:    String(row["evidence_type"]) as EvidenceType,
    title:           String(row["title"]),
    status:          String(row["status"]) as EvidenceStatus,
    dueDate:         row["due_date"]     != null ? String(row["due_date"])     : null,
    documentId:      row["document_id"]  != null ? String(row["document_id"])  : null,
    requestedAt:     row["requested_at"] != null ? String(row["requested_at"]) : null,
    collectedAt:     row["collected_at"] != null ? String(row["collected_at"]) : null,
    confirmedAt:     row["confirmed_at"] != null ? String(row["confirmed_at"]) : null,
    note:            row["note"]         != null ? String(row["note"])         : null,
    createdAt:       String(row["created_at"]),
    updatedAt:       String(row["updated_at"]),
  };
}
