/**
 * 社労士専用ポータル リポジトリ
 *
 * specialist_cases / deficiency_requests / specialist_comments テーブルへのアクセス。
 * サーバーサイド（Server Action / Route Handler）限定。
 * External Specialist ロール専用ロジックを集約する。
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------

export interface SpecialistCaseRow {
  /** specialist_cases.id */
  scId: string;
  caseId: string;
  caseCode: string;
  caseName: string;
  organizationName: string;
  operatingCompanyName: string;
  status: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  finalApplicationDueDate: string | null;
  sharedAt: string;
  submittedAt: string | null;
  submissionMethod: string | null;
  finalCompletedAt: string | null;
}

export interface SpecialistDocumentRow {
  id: string;
  caseId: string;
  documentTypeName: string;
  documentTypeCode: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  versionNo: number;
  reviewStatus: string;
  uploadedAt: string;
  storagePath: string;
  storageBucket: string;
  /** 受講者氏名（受講者単位書類の場合） */
  participantName: string | null;
}

export interface SpecialistCaseDetail extends SpecialistCaseRow {
  documents: SpecialistDocumentRow[];
  participants: SpecialistParticipantRow[];
}

export interface SpecialistParticipantRow {
  id: string;
  name: string;
  nameKana: string | null;
  email: string | null;
  department: string | null;
  employmentType: string | null;
  joinedAt: string | null;
  learnerStatus: string;
}

// ---------------------------------------------------------------
// 案件と社労士の紐付け
// ---------------------------------------------------------------

export async function replaceCaseSpecialistAssignment(params: {
  caseId: string;
  specialistUserId: string;
  sharedBy: string;
  note?: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error: deactivateError } = await supabase
    .from("specialist_cases")
    .update({ is_active: false })
    .eq("case_id", params.caseId)
    .neq("specialist_user_id", params.specialistUserId)
    .eq("is_active", true);

  if (deactivateError) throw new Error(deactivateError.message);

  const { error: upsertError } = await supabase
    .from("specialist_cases")
    .upsert(
      {
        case_id:            params.caseId,
        specialist_user_id: params.specialistUserId,
        shared_by:          params.sharedBy,
        shared_at:          now,
        is_active:          true,
        note:               params.note ?? null,
      },
      { onConflict: "case_id,specialist_user_id" }
    );

  if (upsertError) throw new Error(upsertError.message);
}

// ---------------------------------------------------------------
// 担当案件一覧
// ---------------------------------------------------------------

export async function listSpecialistCases(
  specialistUserId: string
): Promise<SpecialistCaseRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("specialist_cases")
    .select(`
      id,
      case_id,
      shared_at,
      submitted_at,
      submission_method,
      final_completed_at,
      cases (
        id,
        case_code,
        case_name,
        status,
        planned_start_date,
        planned_end_date,
        final_application_due_date,
        organizations ( legal_name ),
        operating_companies ( name )
      )
    `)
    .eq("specialist_user_id", specialistUserId)
    .eq("is_active", true)
    .order("shared_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const c = (row.cases as unknown) as Record<string, unknown> | null;
    const org = (c?.["organizations"] as unknown) as Record<string, unknown> | null;
    const oc = (c?.["operating_companies"] as unknown) as Record<string, unknown> | null;
    return {
      scId:                    String(row.id),
      caseId:                  String(row.case_id),
      caseCode:                c?.["case_code"] != null ? String(c["case_code"]) : "",
      caseName:                c?.["case_name"] != null ? String(c["case_name"]) : "",
      organizationName:        org?.["legal_name"] != null ? String(org["legal_name"]) : "",
      operatingCompanyName:    oc?.["name"] != null ? String(oc["name"]) : "",
      status:                  c?.["status"] != null ? String(c["status"]) : "",
      plannedStartDate:        c?.["planned_start_date"] != null ? String(c["planned_start_date"]) : null,
      plannedEndDate:          c?.["planned_end_date"] != null ? String(c["planned_end_date"]) : null,
      finalApplicationDueDate: c?.["final_application_due_date"] != null ? String(c["final_application_due_date"]) : null,
      sharedAt:                String(row.shared_at),
      submittedAt:             row.submitted_at != null ? String(row.submitted_at) : null,
      submissionMethod:        row.submission_method != null ? String(row.submission_method) : null,
      finalCompletedAt:        row.final_completed_at != null ? String(row.final_completed_at) : null,
    };
  });
}

// ---------------------------------------------------------------
// 担当案件詳細（書類・受講者含む）
// ---------------------------------------------------------------

export async function getSpecialistCaseDetail(
  caseId: string,
  specialistUserId: string
): Promise<SpecialistCaseDetail | null> {
  const supabase = await createClient();

  // specialist_cases でアクセス権確認
  const { data: scData, error: scError } = await supabase
    .from("specialist_cases")
    .select(`
      id,
      case_id,
      shared_at,
      submitted_at,
      submission_method,
      final_completed_at,
      cases (
        id,
        case_code,
        case_name,
        status,
        planned_start_date,
        planned_end_date,
        final_application_due_date,
        organizations ( legal_name ),
        operating_companies ( name )
      )
    `)
    .eq("case_id", caseId)
    .eq("specialist_user_id", specialistUserId)
    .eq("is_active", true)
    .maybeSingle();

  if (scError || !scData) return null;

  const c = (scData.cases as unknown) as Record<string, unknown> | null;
  const org = (c?.["organizations"] as unknown) as Record<string, unknown> | null;
  const oc = (c?.["operating_companies"] as unknown) as Record<string, unknown> | null;

  const base: SpecialistCaseRow = {
    scId:                    String(scData.id),
    caseId:                  String(scData.case_id),
    caseCode:                c?.["case_code"] != null ? String(c["case_code"]) : "",
    caseName:                c?.["case_name"] != null ? String(c["case_name"]) : "",
    organizationName:        org?.["legal_name"] != null ? String(org["legal_name"]) : "",
    operatingCompanyName:    oc?.["name"] != null ? String(oc["name"]) : "",
    status:                  c?.["status"] != null ? String(c["status"]) : "",
    plannedStartDate:        c?.["planned_start_date"] != null ? String(c["planned_start_date"]) : null,
    plannedEndDate:          c?.["planned_end_date"] != null ? String(c["planned_end_date"]) : null,
    finalApplicationDueDate: c?.["final_application_due_date"] != null ? String(c["final_application_due_date"]) : null,
    sharedAt:                String(scData.shared_at),
    submittedAt:             scData.submitted_at != null ? String(scData.submitted_at) : null,
    submissionMethod:        scData.submission_method != null ? String(scData.submission_method) : null,
    finalCompletedAt:        scData.final_completed_at != null ? String(scData.final_completed_at) : null,
  };

  // 書類一覧（最新バージョンのみ、論理削除除外）
  const { data: docs } = await supabase
    .from("documents")
    .select(`
      id,
      case_id,
      document_type_id,
      participant_id,
      original_filename,
      mime_type,
      file_size,
      version_no,
      review_status,
      uploaded_at,
      storage_path,
      storage_bucket,
      document_types ( name, code ),
      participants ( name )
    `)
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .is("replaced_document_id", null)
    .order("uploaded_at", { ascending: false });

  const documents: SpecialistDocumentRow[] = (docs ?? []).map((d) => {
    const dt = (d.document_types as unknown) as Record<string, unknown> | null;
    const pt = (d.participants as unknown) as Record<string, unknown> | null;
    return {
      id:                String(d.id),
      caseId:            String(d.case_id),
      documentTypeName:  dt?.["name"] != null ? String(dt["name"]) : "",
      documentTypeCode:  dt?.["code"] != null ? String(dt["code"]) : "",
      originalFilename:  String(d.original_filename),
      mimeType:          String(d.mime_type),
      fileSize:          Number(d.file_size),
      versionNo:         Number(d.version_no),
      reviewStatus:      String(d.review_status),
      uploadedAt:        String(d.uploaded_at),
      storagePath:       String(d.storage_path),
      storageBucket:     String(d.storage_bucket),
      participantName:   pt?.["name"] != null ? String(pt["name"]) : null,
    };
  });

  // 受講者一覧
  const { data: pts } = await supabase
    .from("participants")
    .select("id, name, name_kana, email, department, employment_type, joined_at, learner_status")
    .eq("case_id", caseId)
    .order("name");

  const participants: SpecialistParticipantRow[] = (pts ?? []).map((p) => ({
    id:             String(p.id),
    name:           String(p.name),
    nameKana:       p.name_kana != null ? String(p.name_kana) : null,
    email:          p.email != null ? String(p.email) : null,
    department:     p.department != null ? String(p.department) : null,
    employmentType: p.employment_type != null ? String(p.employment_type) : null,
    joinedAt:       p.joined_at != null ? String(p.joined_at) : null,
    learnerStatus:  String(p.learner_status),
  }));

  return { ...base, documents, participants };
}

// ---------------------------------------------------------------
// 提出完了記録
// ---------------------------------------------------------------

export async function recordSpecialistSubmission(params: {
  caseId: string;
  specialistUserId: string;
  submittedAt: string;
  submissionMethod: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("specialist_cases")
    .update({
      submitted_at:      params.submittedAt,
      submission_method: params.submissionMethod,
    })
    .eq("case_id", params.caseId)
    .eq("specialist_user_id", params.specialistUserId)
    .eq("is_active", true);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------
// 最終申請完了マーク
// ---------------------------------------------------------------

export async function markSpecialistFinalComplete(params: {
  caseId: string;
  specialistUserId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("specialist_cases")
    .update({
      final_completed_at: new Date().toISOString(),
      final_completed_by: params.specialistUserId,
    })
    .eq("case_id", params.caseId)
    .eq("specialist_user_id", params.specialistUserId)
    .eq("is_active", true);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------
// 不備依頼 (deficiency_requests)
// ---------------------------------------------------------------

export type DeficiencyStatus = "open" | "responded" | "resolved";

export interface RequiredFileItem {
  label: string;
  note?: string;
}

export interface DeficiencyRequestRow {
  id: string;
  caseId: string;
  createdBy: string | null;
  createdByName: string | null;
  description: string;
  requiredFiles: RequiredFileItem[];
  deadline: string | null;
  status: DeficiencyStatus;
  respondedAt: string | null;
  respondedBy: string | null;
  respondedByName: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolvedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listDeficiencyRequests(
  caseId: string
): Promise<DeficiencyRequestRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deficiency_requests")
    .select(`
      id, case_id, description, required_files, deadline, status,
      responded_at, responded_by, resolved_at, resolved_by,
      created_at, updated_at,
      created_by,
      creator:user_profiles!deficiency_requests_created_by_fkey(display_name),
      responder:user_profiles!deficiency_requests_responded_by_fkey(display_name),
      resolver:user_profiles!deficiency_requests_resolved_by_fkey(display_name)
    `)
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((r) => {
    const creator   = (r.creator   as unknown) as Record<string, unknown> | null;
    const responder = (r.responder as unknown) as Record<string, unknown> | null;
    const resolver  = (r.resolver  as unknown) as Record<string, unknown> | null;
    return {
      id:              String(r.id),
      caseId:          String(r.case_id),
      createdBy:       r.created_by   ? String(r.created_by)   : null,
      createdByName:   creator?.display_name   ? String(creator.display_name)   : null,
      description:     String(r.description),
      requiredFiles:   Array.isArray(r.required_files) ? (r.required_files as RequiredFileItem[]) : [],
      deadline:        r.deadline     ? String(r.deadline)      : null,
      status:          r.status       as DeficiencyStatus,
      respondedAt:     r.responded_at ? String(r.responded_at)  : null,
      respondedBy:     r.responded_by ? String(r.responded_by)  : null,
      respondedByName: responder?.display_name ? String(responder.display_name) : null,
      resolvedAt:      r.resolved_at  ? String(r.resolved_at)   : null,
      resolvedBy:      r.resolved_by  ? String(r.resolved_by)   : null,
      resolvedByName:  resolver?.display_name  ? String(resolver.display_name)  : null,
      createdAt:       String(r.created_at),
      updatedAt:       String(r.updated_at),
    };
  });
}

export interface CreateDeficiencyInput {
  caseId: string;
  createdBy: string;
  description: string;
  requiredFiles: RequiredFileItem[];
  deadline: string | null;
}

export async function createDeficiencyRequest(
  input: CreateDeficiencyInput
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deficiency_requests")
    .insert({
      case_id:        input.caseId,
      created_by:     input.createdBy,
      description:    input.description,
      required_files: input.requiredFiles,
      deadline:       input.deadline ?? null,
      status:         "open",
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message };
  return { ok: true, id: String(data.id) };
}

export interface UpdateDeficiencyStatusInput {
  id: string;
  caseId: string;
  status: "responded" | "resolved";
  userId: string;
}

export async function updateDeficiencyStatus(
  input: UpdateDeficiencyStatusInput
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const now = new Date().toISOString();
  const patch =
    input.status === "responded"
      ? { status: "responded", responded_at: now, responded_by: input.userId }
      : { status: "resolved",  resolved_at: now,  resolved_by:  input.userId };

  const { error } = await supabase
    .from("deficiency_requests")
    .update(patch)
    .eq("id", input.id)
    .eq("case_id", input.caseId)
    .is("deleted_at", null);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------
// 社労士コメント (specialist_comments)
// ---------------------------------------------------------------

export interface SpecialistCommentRow {
  id: string;
  caseId: string;
  authorId: string;
  authorName: string | null;
  body: string;
  isFromSpecialist: boolean;
  parentId: string | null;
  createdAt: string;
}

export async function listSpecialistComments(
  caseId: string
): Promise<SpecialistCommentRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("specialist_comments")
    .select(`
      id, case_id, author_id, body, is_from_specialist, parent_id, created_at,
      author:user_profiles!specialist_comments_author_id_fkey(display_name)
    `)
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((r) => {
    const author = (r.author as unknown) as Record<string, unknown> | null;
    return {
      id:               String(r.id),
      caseId:           String(r.case_id),
      authorId:         String(r.author_id),
      authorName:       author?.display_name ? String(author.display_name) : null,
      body:             String(r.body),
      isFromSpecialist: Boolean(r.is_from_specialist),
      parentId:         r.parent_id ? String(r.parent_id) : null,
      createdAt:        String(r.created_at),
    };
  });
}

export interface CreateSpecialistCommentInput {
  caseId: string;
  authorId: string;
  body: string;
  isFromSpecialist: boolean;
  parentId?: string | null;
}

export async function createSpecialistComment(
  input: CreateSpecialistCommentInput
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("specialist_comments")
    .insert({
      case_id:            input.caseId,
      author_id:          input.authorId,
      body:               input.body.trim(),
      is_from_specialist: input.isFromSpecialist,
      parent_id:          input.parentId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message };
  return { ok: true, id: String(data.id) };
}

// ---------------------------------------------------------------
// 書類の署名付きURL発行（社労士専用 — アクセス権確認済み前提）
// ---------------------------------------------------------------

export async function createSpecialistSignedUrl(
  storageBucket: string,
  storagePath: string,
  expiresInSeconds = 300
): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(storageBucket)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data) {
    throw new Error(`signed url creation failed: ${error?.message}`);
  }
  return data.signedUrl;
}
