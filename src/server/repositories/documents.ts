/**
 * 書類・ファイル リポジトリ
 *
 * documents / document_requirements / document_types テーブルへのアクセス。
 * サーバーサイド（Server Action / Route Handler）限定。
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Document,
  DocumentRequirement,
  DocumentType,
  CaseDocumentSummary,
  ParticipantDocumentSummary,
  ConfirmUploadRequest,
  ReviewStatus,
  ReturnReason,
} from "@/types/documents";

// ------------------------------------------------------------
// 型変換ヘルパー
// ------------------------------------------------------------

function toDocumentType(row: Record<string, unknown>): DocumentType {
  return {
    id:            row.id as string,
    code:          row.code as string,
    name:          row.name as string,
    scope:         row.scope as DocumentType["scope"],
    reusableLevel: row.reusable_level as DocumentType["reusableLevel"],
    description:   row.description as string | null,
    sortOrder:     row.sort_order as number,
    active:        row.active as boolean,
  };
}

function toDocument(row: Record<string, unknown>): Document {
  return {
    id:                    row.id as string,
    caseId:                row.case_id as string,
    organizationId:        row.organization_id as string,
    participantId:         row.participant_id as string | null,
    documentRequirementId: row.document_requirement_id as string | null,
    documentTypeId:        row.document_type_id as string,
    documentType:          row.document_types
      ? toDocumentType(row.document_types as Record<string, unknown>)
      : ({} as DocumentType),
    storageBucket:         row.storage_bucket as string,
    storagePath:           row.storage_path as string,
    originalFilename:      row.original_filename as string,
    mimeType:              row.mime_type as string,
    fileSize:              row.file_size as number,
    versionNo:             row.version_no as number,
    replacedDocumentId:    row.replaced_document_id as string | null,
    reviewStatus:          row.review_status as ReviewStatus,
    returnReason:          row.return_reason as ReturnReason | null,
    returnReasonDetail:    row.return_reason_detail as string | null,
    uploadedByUserId:      row.uploaded_by_user_id as string | null,
    uploadedAt:            row.uploaded_at as string,
    deletedAt:             row.deleted_at as string | null,
  };
}

function toRequirement(row: Record<string, unknown>): DocumentRequirement {
  return {
    id:               row.id as string,
    caseId:           row.case_id as string,
    participantId:    row.participant_id as string | null,
    documentTypeId:   row.document_type_id as string,
    documentType:     row.document_types
      ? toDocumentType(row.document_types as Record<string, unknown>)
      : ({} as DocumentType),
    requiredFlag:     row.required_flag as boolean,
    dueDate:          row.due_date as string | null,
    status:           row.status as DocumentRequirement["status"],
    requestedAt:      row.requested_at as string | null,
    approvedAt:       row.approved_at as string | null,
    note:             row.note as string | null,
    latestDocument:   row.latest_document
      ? toDocument(row.latest_document as Record<string, unknown>)
      : null,
  };
}

// ------------------------------------------------------------
// document_types
// ------------------------------------------------------------

export async function listDocumentTypes(): Promise<DocumentType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_types")
    .select("*")
    .eq("active", true)
    .order("sort_order");

  if (error) throw new Error(`document_types fetch failed: ${error.message}`);
  return (data ?? []).map((r) => toDocumentType(r as Record<string, unknown>));
}

// ------------------------------------------------------------
// document_requirements
// ------------------------------------------------------------

export async function listRequirementsByCase(caseId: string): Promise<DocumentRequirement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_requirements")
    .select(`
      *,
      document_types (*)
    `)
    .eq("case_id", caseId)
    .is("participant_id", null)
    .order("created_at");

  if (error) throw new Error(`document_requirements fetch failed: ${error.message}`);

  const requirements = (data ?? []).map((r) => toRequirement(r as Record<string, unknown>));

  // 各要件の最新ファイルを取得
  await attachLatestDocuments(supabase, requirements);
  return requirements;
}

/** 案件の全書類要件（受講者紐付きを含む）を取得 */
export async function listAllRequirementsByCase(caseId: string): Promise<DocumentRequirement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_requirements")
    .select(`
      *,
      document_types (*)
    `)
    .eq("case_id", caseId)
    .order("participant_id", { ascending: true, nullsFirst: true })
    .order("created_at");

  if (error) throw new Error(`document_requirements fetch failed: ${error.message}`);

  const requirements = (data ?? []).map((r) => toRequirement(r as Record<string, unknown>));
  await attachLatestDocuments(supabase, requirements);
  return requirements;
}

export async function listRequirementsByParticipant(
  caseId: string,
  participantId: string
): Promise<DocumentRequirement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_requirements")
    .select(`
      *,
      document_types (*)
    `)
    .eq("case_id", caseId)
    .eq("participant_id", participantId)
    .order("created_at");

  if (error) throw new Error(`document_requirements fetch failed: ${error.message}`);

  const requirements = (data ?? []).map((r) => toRequirement(r as Record<string, unknown>));
  await attachLatestDocuments(supabase, requirements);
  return requirements;
}

/** 要件に最新版ドキュメントを紐付ける */
async function attachLatestDocuments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requirements: DocumentRequirement[]
): Promise<void> {
  if (requirements.length === 0) return;

  const ids = requirements.map((r) => r.id);
  const { data } = await supabase
    .from("documents")
    .select("*, document_types (*)")
    .in("document_requirement_id", ids)
    .is("deleted_at", null)
    .order("version_no", { ascending: false });

  if (!data) return;

  // 要件IDごとに最大version_noのファイルを取得
  const latestMap = new Map<string, Record<string, unknown>>();
  for (const doc of data) {
    const reqId = doc.document_requirement_id as string;
    if (!latestMap.has(reqId)) {
      latestMap.set(reqId, doc as Record<string, unknown>);
    }
  }

  for (const req of requirements) {
    const latest = latestMap.get(req.id);
    req.latestDocument = latest ? toDocument(latest) : null;
  }
}

export async function createRequirement(params: {
  caseId: string;
  participantId?: string;
  documentTypeId: string;
  requiredFlag?: boolean;
  dueDate?: string;
  note?: string;
}): Promise<DocumentRequirement> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_requirements")
    .insert({
      case_id:           params.caseId,
      participant_id:    params.participantId ?? null,
      document_type_id:  params.documentTypeId,
      required_flag:     params.requiredFlag ?? true,
      due_date:          params.dueDate ?? null,
      note:              params.note ?? null,
      requested_at:      new Date().toISOString(),
    })
    .select("*, document_types (*)")
    .single();

  if (error) throw new Error(`document_requirement create failed: ${error.message}`);
  return toRequirement(data as unknown as Record<string, unknown>);
}

export async function updateRequirementStatus(
  requirementId: string,
  status: DocumentRequirement["status"],
  approvedAt?: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("document_requirements")
    .update({
      status,
      approved_at: approvedAt ?? null,
    })
    .eq("id", requirementId);

  if (error) throw new Error(`requirement status update failed: ${error.message}`);
}

// ------------------------------------------------------------
// documents
// ------------------------------------------------------------

export async function listDocumentsByCase(caseId: string): Promise<Document[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*, document_types (*)")
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false });

  if (error) throw new Error(`documents fetch failed: ${error.message}`);
  return (data ?? []).map((r) => toDocument(r as unknown as Record<string, unknown>));
}

export async function listDocumentVersions(
  requirementId: string
): Promise<Document[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*, document_types (*)")
    .eq("document_requirement_id", requirementId)
    .is("deleted_at", null)
    .order("version_no", { ascending: false });

  if (error) throw new Error(`document versions fetch failed: ${error.message}`);
  return (data ?? []).map((r) => toDocument(r as unknown as Record<string, unknown>));
}

export async function getDocumentById(id: string): Promise<Document | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*, document_types (*)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`document fetch failed: ${error.message}`);
  return data ? toDocument(data as unknown as Record<string, unknown>) : null;
}

/** アップロード完了後にメタデータを登録する */
export async function registerDocument(
  params: ConfirmUploadRequest,
  uploadedByUserId: string | null,
  uploadTokenId: string | null = null
): Promise<Document> {
  const supabase = await createClient();

  // 同一要件への差替の場合、バージョン番号を計算
  let versionNo = 1;
  if (params.documentRequirementId) {
    const { data: existing } = await supabase
      .from("documents")
      .select("version_no")
      .eq("document_requirement_id", params.documentRequirementId)
      .is("deleted_at", null)
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      versionNo = (existing.version_no as number) + 1;
    }
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      case_id:                  params.caseId,
      organization_id:          params.organizationId,
      participant_id:           params.participantId ?? null,
      document_requirement_id:  params.documentRequirementId ?? null,
      document_type_id:         params.documentTypeId,
      storage_bucket:           "case-documents",
      storage_path:             params.storagePath,
      original_filename:        params.originalFilename,
      mime_type:                params.mimeType,
      file_size:                params.fileSize,
      version_no:               versionNo,
      replaced_document_id:     params.replacedDocumentId ?? null,
      review_status:            "uploaded",
      uploaded_by_user_id:      uploadedByUserId,
      upload_token_id:          uploadTokenId,
      uploaded_at:              new Date().toISOString(),
    })
    .select("*, document_types (*)")
    .single();

  if (error) throw new Error(`document register failed: ${error.message}`);

  // 要件ステータスを「受領済み」に更新
  if (params.documentRequirementId) {
    await updateRequirementStatus(params.documentRequirementId, "received");
  }

  return toDocument(data as unknown as Record<string, unknown>);
}

/** レビューステータス更新（差戻し・承認） */
export async function updateDocumentReviewStatus(params: {
  documentId:        string;
  reviewStatus:      ReviewStatus;
  returnReason?:     ReturnReason;
  returnReasonDetail?: string;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .update({
      review_status:       params.reviewStatus,
      return_reason:       params.returnReason ?? null,
      return_reason_detail: params.returnReasonDetail ?? null,
    })
    .eq("id", params.documentId);

  if (error) throw new Error(`document review status update failed: ${error.message}`);

  // 差戻しの場合は要件ステータスも更新
  if (params.reviewStatus === "returned") {
    const doc = await getDocumentById(params.documentId);
    if (doc?.documentRequirementId) {
      await updateRequirementStatus(doc.documentRequirementId, "returned");
    }
  }
  if (params.reviewStatus === "approved") {
    const doc = await getDocumentById(params.documentId);
    if (doc?.documentRequirementId) {
      await updateRequirementStatus(
        doc.documentRequirementId,
        "approved",
        new Date().toISOString()
      );
    }
  }
}

/** 論理削除 */
export async function softDeleteDocument(documentId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", documentId);

  if (error) throw new Error(`document delete failed: ${error.message}`);
}

// ------------------------------------------------------------
// 充足率集計
// ------------------------------------------------------------

export async function getCaseDocumentSummary(
  caseId: string
): Promise<CaseDocumentSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("case_document_summary")
    .select("*")
    .eq("case_id", caseId)
    .maybeSingle();

  if (error) throw new Error(`case_document_summary fetch failed: ${error.message}`);
  if (!data) return null;

  const d = data as Record<string, unknown>;
  const requiredCount  = (d.required_count  as number) ?? 0;
  const approvedCount  = (d.approved_count  as number) ?? 0;

  return {
    caseId:               d.case_id as string,
    totalRequirements:    (d.total_requirements as number) ?? 0,
    requiredCount,
    approvedCount,
    receivedCount:        (d.received_count  as number) ?? 0,
    returnedCount:        (d.returned_count  as number) ?? 0,
    pendingRequiredCount: (d.pending_required_count as number) ?? 0,
    insufficientCount:    (d.insufficient_count as number) ?? 0,
    completionRate:       requiredCount > 0
      ? Math.round((approvedCount / requiredCount) * 100)
      : 0,
  };
}

export async function getParticipantDocumentSummaries(
  caseId: string
): Promise<ParticipantDocumentSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("participant_document_summary")
    .select("*")
    .eq("case_id", caseId);

  if (error) throw new Error(`participant_document_summary fetch failed: ${error.message}`);

  return (data ?? []).map((d) => {
    const row = d as Record<string, unknown>;
    const requiredCount = (row.required_count as number) ?? 0;
    const approvedCount = (row.approved_count as number) ?? 0;
    return {
      participantId:     row.participant_id as string,
      caseId:            row.case_id as string,
      totalRequirements: (row.total_requirements as number) ?? 0,
      requiredCount,
      approvedCount,
      returnedCount:     (row.returned_count as number) ?? 0,
      insufficientCount: (row.insufficient_count as number) ?? 0,
      completionRate:    requiredCount > 0
        ? Math.round((approvedCount / requiredCount) * 100)
        : 0,
    };
  });
}

// ------------------------------------------------------------
// Storage: 署名付きURL（管理者クライアント使用）
// ------------------------------------------------------------

/** 署名付きアップロードURLを発行する（60秒有効） */
export async function createUploadSignedUrl(storagePath: string): Promise<{
  signedUrl: string;
  token:     string;
}> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("case-documents")
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    throw new Error(`signed upload url creation failed: ${error?.message}`);
  }
  return { signedUrl: data.signedUrl, token: data.token };
}

/** 署名付き閲覧URLを発行する（300秒有効） */
export async function createViewSignedUrl(
  storagePath: string,
  expiresInSeconds = 300
): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("case-documents")
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data) {
    throw new Error(`signed view url creation failed: ${error?.message}`);
  }
  return data.signedUrl;
}

// ------------------------------------------------------------
// upload_tokens
// ------------------------------------------------------------

export async function createUploadToken(params: {
  caseId:          string;
  organizationId:  string;
  createdByUserId: string;
  expiresAt:       string;
  note?:           string;
}): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("upload_tokens")
    .insert({
      case_id:             params.caseId,
      organization_id:     params.organizationId,
      created_by_user_id:  params.createdByUserId,
      expires_at:          params.expiresAt,
      is_active:           true,
      note:                params.note ?? null,
    })
    .select("token")
    .single();

  if (error) throw new Error(`upload_token create failed: ${error.message}`);
  return (data as { token: string }).token;
}

export async function getUploadToken(token: string): Promise<{
  id:             string;
  caseId:         string;
  organizationId: string;
  isActive:       boolean;
  expiresAt:      string;
} | null> {
  // トークンは未認証ユーザーが使用するため、サービスロールキーで検索
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("upload_tokens")
    .select("id, case_id, organization_id, is_active, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error) throw new Error(`upload_token fetch failed: ${error.message}`);
  if (!data) return null;

  const d = data as Record<string, unknown>;
  return {
    id:             d.id as string,
    caseId:         d.case_id as string,
    organizationId: d.organization_id as string,
    isActive:       d.is_active as boolean,
    expiresAt:      d.expires_at as string,
  };
}

// ------------------------------------------------------------
// 全案件横断：要対応書類一覧
// ------------------------------------------------------------

import type { DocumentRequirementStatus } from "@/types/documents";

export interface AttentionRequirement {
  id:               string;
  caseId:           string;
  caseName:         string;
  caseCode:         string;
  organizationName: string;
  documentTypeName: string;
  status:           DocumentRequirementStatus;
  dueDate:          string | null;
  participantId:    string | null;
}

export async function listAttentionRequirements(): Promise<AttentionRequirement[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("document_requirements")
    .select(
      `id, case_id, participant_id, status, due_date,
       document_types ( name ),
       cases ( case_name, case_code, deleted_at, organizations ( legal_name ) )`
    )
    .in("status", ["pending", "returned"])
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((r) => {
      const c = (r["cases"] as unknown) as Record<string, unknown> | null;
      return c?.["deleted_at"] == null;
    })
    .map((r) => {
      const c   = (r["cases"]        as unknown) as Record<string, unknown> | null;
      const org = (c?.["organizations"] as unknown) as Record<string, unknown> | null;
      const dt  = (r["document_types"] as unknown) as Record<string, unknown> | null;
      return {
        id:               String(r["id"]),
        caseId:           String(r["case_id"]),
        caseName:         c   ? String(c["case_name"])    : "",
        caseCode:         c   ? String(c["case_code"])    : "",
        organizationName: org ? String(org["legal_name"]) : "",
        documentTypeName: dt  ? String(dt["name"])        : "",
        status:           String(r["status"]) as DocumentRequirementStatus,
        dueDate:          r["due_date"] != null ? String(r["due_date"]) : null,
        participantId:    r["participant_id"] != null ? String(r["participant_id"]) : null,
      };
    });
}
