/**
 * 受講者 リポジトリ
 */

import { createClient } from "@/lib/supabase/server";
import type { LearnerStatus } from "@/lib/constants/case-status";

export interface ParticipantRow {
  id: string;
  caseId: string;
  employeeCode: string | null;
  name: string;
  nameKana: string | null;
  email: string | null;
  department: string | null;
  employmentType: string | null;
  joinedAt: string | null;
  learnerStatus: LearnerStatus;
  excludedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateParticipantInput {
  caseId: string;
  employeeCode?: string;
  name: string;
  nameKana?: string;
  email?: string;
  department?: string;
  employmentType?: string;
  joinedAt?: string;
  learnerStatus?: LearnerStatus;
}

export interface UpdateParticipantInput {
  employeeCode?: string;
  name?: string;
  nameKana?: string;
  email?: string;
  department?: string;
  employmentType?: string;
  joinedAt?: string;
  learnerStatus?: LearnerStatus;
  excludedReason?: string;
}

// ---------------------------------------------------------------
// 案件の受講者一覧
// ---------------------------------------------------------------
export async function listParticipants(caseId: string): Promise<ParticipantRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("participants")
    .select(
      "id, case_id, employee_code, name, name_kana, email, department, employment_type, joined_at, learner_status, excluded_reason, created_at, updated_at"
    )
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapParticipant);
}

// ---------------------------------------------------------------
// 受講者詳細
// ---------------------------------------------------------------
export async function getParticipant(id: string): Promise<ParticipantRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("participants")
    .select(
      "id, case_id, employee_code, name, name_kana, email, department, employment_type, joined_at, learner_status, excluded_reason, created_at, updated_at"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;
  return mapParticipant(data);
}

// ---------------------------------------------------------------
// 受講者作成（1件）
// ---------------------------------------------------------------
export async function createParticipant(input: CreateParticipantInput): Promise<ParticipantRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("participants")
    .insert({
      case_id:         input.caseId,
      employee_code:   input.employeeCode ?? null,
      name:            input.name,
      name_kana:       input.nameKana ?? null,
      email:           input.email ?? null,
      department:      input.department ?? null,
      employment_type: input.employmentType ?? null,
      joined_at:       input.joinedAt ?? null,
      learner_status:  input.learnerStatus ?? "planned",
    })
    .select(
      "id, case_id, employee_code, name, name_kana, email, department, employment_type, joined_at, learner_status, excluded_reason, created_at, updated_at"
    )
    .single();

  if (error || !data) throw new Error(error?.message ?? "受講者の作成に失敗しました");
  return mapParticipant(data);
}

// ---------------------------------------------------------------
// 受講者一括作成（CSV取込用）
// ---------------------------------------------------------------
export async function bulkCreateParticipants(
  caseId: string,
  rows: Omit<CreateParticipantInput, "caseId">[]
): Promise<number> {
  const supabase = await createClient();

  const inserts = rows.map((r) => ({
    case_id:         caseId,
    employee_code:   r.employeeCode ?? null,
    name:            r.name,
    name_kana:       r.nameKana ?? null,
    email:           r.email ?? null,
    department:      r.department ?? null,
    employment_type: r.employmentType ?? null,
    joined_at:       r.joinedAt ?? null,
    learner_status:  r.learnerStatus ?? "planned",
  }));

  const { error, count } = await supabase
    .from("participants")
    .insert(inserts, { count: "exact" });

  if (error) throw new Error(error.message);
  return count ?? rows.length;
}

// ---------------------------------------------------------------
// 受講者更新
// ---------------------------------------------------------------
export async function updateParticipant(id: string, input: UpdateParticipantInput): Promise<void> {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};
  if (input.employeeCode   !== undefined) updates["employee_code"]   = input.employeeCode;
  if (input.name           !== undefined) updates["name"]            = input.name;
  if (input.nameKana       !== undefined) updates["name_kana"]       = input.nameKana;
  if (input.email          !== undefined) updates["email"]           = input.email;
  if (input.department     !== undefined) updates["department"]      = input.department;
  if (input.employmentType !== undefined) updates["employment_type"] = input.employmentType;
  if (input.joinedAt       !== undefined) updates["joined_at"]       = input.joinedAt;
  if (input.learnerStatus  !== undefined) updates["learner_status"]  = input.learnerStatus;
  if (input.excludedReason !== undefined) updates["excluded_reason"] = input.excludedReason;

  const { error } = await supabase
    .from("participants")
    .update(updates)
    .eq("id", id)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------
// 受講者論理削除
// ---------------------------------------------------------------
export async function deleteParticipant(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("participants")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------
// 案件の受講者数
// ---------------------------------------------------------------
export async function countParticipants(caseId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .neq("learner_status", "excluded");

  if (error) return 0;
  return count ?? 0;
}

// ---------------------------------------------------------------
// 全案件横断：受講者一覧
// ---------------------------------------------------------------
export interface ParticipantWithCaseRow extends ParticipantRow {
  caseName:         string;
  caseCode:         string;
  organizationName: string;
}

export async function listAllParticipants(): Promise<ParticipantWithCaseRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("participants")
    .select(
      `id, case_id, employee_code, name, name_kana, email, department, employment_type,
       joined_at, learner_status, excluded_reason, created_at, updated_at,
       cases ( case_name, case_code, organizations ( legal_name ) )`
    )
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => {
    const c   = (r["cases"]   as unknown) as Record<string, unknown> | null;
    const org = (c?.["organizations"] as unknown) as Record<string, unknown> | null;
    return {
      ...mapParticipant(r as Record<string, unknown>),
      caseName:         c   ? String(c["case_name"])    : "",
      caseCode:         c   ? String(c["case_code"])    : "",
      organizationName: org ? String(org["legal_name"]) : "",
    };
  });
}

// ---------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------
function mapParticipant(row: Record<string, unknown>): ParticipantRow {
  return {
    id:             String(row["id"]),
    caseId:         String(row["case_id"]),
    employeeCode:   row["employee_code"] != null ? String(row["employee_code"]) : null,
    name:           String(row["name"]),
    nameKana:       row["name_kana"] != null ? String(row["name_kana"]) : null,
    email:          row["email"] != null ? String(row["email"]) : null,
    department:     row["department"] != null ? String(row["department"]) : null,
    employmentType: row["employment_type"] != null ? String(row["employment_type"]) : null,
    joinedAt:       row["joined_at"] != null ? String(row["joined_at"]) : null,
    learnerStatus:  String(row["learner_status"]) as LearnerStatus,
    excludedReason: row["excluded_reason"] != null ? String(row["excluded_reason"]) : null,
    createdAt:      String(row["created_at"]),
    updatedAt:      String(row["updated_at"]),
  };
}
