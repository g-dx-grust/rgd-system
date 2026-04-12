/**
 * LMS リポジトリ
 * lms_progress_snapshots / lms_sync_logs / lms_settings の CRUD
 */

import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------

export interface LmsProgressSnapshotRow {
  id: string;
  caseId: string;
  participantId: string;
  syncLogId: string | null;
  lmsUserId: string | null;
  progressRate: number;
  isCompleted: boolean;
  lastAccessAt: string | null;
  totalWatchSeconds: number | null;
  rawPayload: Record<string, unknown> | null;
  syncedAt: string;
  createdAt: string;
}

export interface LmsSyncLogRow {
  id: string;
  caseId: string;
  adapterType: string;
  status: "running" | "success" | "partial" | "failed";
  triggeredBy: string | null;
  totalRecords: number | null;
  successRecords: number | null;
  errorRecords: number | null;
  errorDetail: string | null;
  sourceFilename: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
}

export interface LmsSettingRow {
  id: string;
  caseId: string | null;
  adapterType: string;
  config: Record<string, unknown>;
  stagnationDays: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSyncLogInput {
  caseId: string;
  adapterType: string;
  triggeredBy: string | null;
  sourceFilename?: string;
}

export interface UpdateSyncLogInput {
  status: "success" | "partial" | "failed";
  totalRecords: number;
  successRecords: number;
  errorRecords: number;
  errorDetail?: string;
  finishedAt: string;
}

export interface InsertProgressSnapshotInput {
  caseId: string;
  participantId: string;
  syncLogId: string;
  lmsUserId?: string;
  progressRate: number;
  isCompleted: boolean;
  lastAccessAt: string | null;
  totalWatchSeconds: number | null;
  rawPayload: Record<string, unknown>;
}

// ---------------------------------------------------------------
// 最新進捗スナップショット一覧（案件単位）
// ---------------------------------------------------------------
export async function listLatestProgressSnapshots(
  caseId: string
): Promise<LmsProgressSnapshotRow[]> {
  const supabase = await createClient();

  // 受講者ごとに最新の synced_at を持つレコードを取得
  const { data, error } = await supabase
    .from("lms_progress_snapshots")
    .select(
      "id, case_id, participant_id, sync_log_id, lms_user_id, progress_rate, is_completed, last_access_at, total_watch_seconds, raw_payload, synced_at, created_at"
    )
    .eq("case_id", caseId)
    .order("synced_at", { ascending: false });

  if (error) throw new Error(error.message);

  // JS 側で受講者ごとに最新1件に絞る
  const seen = new Set<string>();
  const latest: LmsProgressSnapshotRow[] = [];
  for (const row of data ?? []) {
    if (!seen.has(row.participant_id)) {
      seen.add(row.participant_id);
      latest.push(mapSnapshot(row));
    }
  }
  return latest;
}

// ---------------------------------------------------------------
// 案件全体の完了率サマリー
// ---------------------------------------------------------------
export async function getCaseProgressSummary(
  caseId: string
): Promise<{ total: number; completed: number; stagnant: number; notStarted: number }> {
  const snapshots = await listLatestProgressSnapshots(caseId);
  const now = Date.now();

  // stagnation_days はデフォルト7日（LmsSettingから取得してもよいが、ここではシンプルに固定）
  const STAGNATION_MS = 7 * 24 * 60 * 60 * 1000;

  let completed = 0;
  let stagnant = 0;
  let notStarted = 0;

  for (const s of snapshots) {
    if (s.isCompleted) {
      completed++;
    } else if (!s.lastAccessAt) {
      notStarted++;
    } else {
      const lastMs = new Date(s.lastAccessAt).getTime();
      if (now - lastMs > STAGNATION_MS) stagnant++;
    }
  }

  return { total: snapshots.length, completed, stagnant, notStarted };
}

// ---------------------------------------------------------------
// 横断進捗サマリー（ステータス = training_in_progress の案件）
// ---------------------------------------------------------------
export interface CaseLmsProgressSummary {
  caseId: string;
  caseName: string;
  caseCode: string;
  organizationName: string;
  totalParticipants: number;
  completedCount: number;
  stagnantCount: number;
  lastSyncedAt: string | null;
}

export async function listCasesLmsProgressSummary(): Promise<CaseLmsProgressSummary[]> {
  const supabase = await createClient();

  // 受講進行中案件を取得
  const { data: cases, error } = await supabase
    .from("cases")
    .select(
      "id, case_name, case_code, organizations!inner(name)"
    )
    .eq("status", "training_in_progress")
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
  if (!cases || cases.length === 0) return [];

  const results: CaseLmsProgressSummary[] = [];

  for (const c of cases) {
    const snapshots = await listLatestProgressSnapshots(c.id);
    const now = Date.now();
    const STAGNATION_MS = 7 * 24 * 60 * 60 * 1000;

    const completed = snapshots.filter((s) => s.isCompleted).length;
    const stagnant = snapshots.filter((s) => {
      if (s.isCompleted || !s.lastAccessAt) return false;
      return now - new Date(s.lastAccessAt).getTime() > STAGNATION_MS;
    }).length;

    const lastSync = snapshots
      .map((s) => s.syncedAt)
      .sort()
      .reverse()[0] ?? null;

    const org = Array.isArray(c.organizations)
      ? (c.organizations[0] as { name: string })?.name ?? ""
      : (c.organizations as { name: string } | null)?.name ?? "";

    results.push({
      caseId:           c.id,
      caseName:         String(c.case_name),
      caseCode:         String(c.case_code),
      organizationName: org,
      totalParticipants: snapshots.length,
      completedCount:   completed,
      stagnantCount:    stagnant,
      lastSyncedAt:     lastSync,
    });
  }

  return results;
}

// ---------------------------------------------------------------
// 同期ログ一覧（案件単位）
// ---------------------------------------------------------------
export async function listSyncLogs(caseId: string, limit = 20): Promise<LmsSyncLogRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lms_sync_logs")
    .select(
      "id, case_id, adapter_type, status, triggered_by, total_records, success_records, error_records, error_detail, source_filename, started_at, finished_at, created_at"
    )
    .eq("case_id", caseId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSyncLog);
}

// ---------------------------------------------------------------
// 同期ログ作成（同期開始時）
// ---------------------------------------------------------------
export async function createSyncLog(input: CreateSyncLogInput): Promise<LmsSyncLogRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lms_sync_logs")
    .insert({
      case_id:         input.caseId,
      adapter_type:    input.adapterType,
      status:          "running",
      triggered_by:    input.triggeredBy,
      source_filename: input.sourceFilename ?? null,
    })
    .select(
      "id, case_id, adapter_type, status, triggered_by, total_records, success_records, error_records, error_detail, source_filename, started_at, finished_at, created_at"
    )
    .single();

  if (error || !data) throw new Error(error?.message ?? "同期ログの作成に失敗しました");
  return mapSyncLog(data);
}

// ---------------------------------------------------------------
// 同期ログ更新（同期完了時）
// ---------------------------------------------------------------
export async function updateSyncLog(
  id: string,
  input: UpdateSyncLogInput
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("lms_sync_logs")
    .update({
      status:          input.status,
      total_records:   input.totalRecords,
      success_records: input.successRecords,
      error_records:   input.errorRecords,
      error_detail:    input.errorDetail ?? null,
      finished_at:     input.finishedAt,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------
// 進捗スナップショット一括追記
// ---------------------------------------------------------------
export async function bulkInsertProgressSnapshots(
  inputs: InsertProgressSnapshotInput[]
): Promise<void> {
  if (inputs.length === 0) return;
  const supabase = await createClient();

  const rows = inputs.map((i) => ({
    case_id:             i.caseId,
    participant_id:      i.participantId,
    sync_log_id:         i.syncLogId,
    lms_user_id:         i.lmsUserId ?? null,
    progress_rate:       i.progressRate,
    is_completed:        i.isCompleted,
    last_access_at:      i.lastAccessAt,
    total_watch_seconds: i.totalWatchSeconds,
    raw_payload:         i.rawPayload,
  }));

  const { error } = await supabase.from("lms_progress_snapshots").insert(rows);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------
// LMS設定取得（案件 or システム全体）
// ---------------------------------------------------------------
export async function getLmsSetting(caseId: string): Promise<LmsSettingRow | null> {
  const supabase = await createClient();

  // 案件固有設定を優先し、なければシステム全体設定を返す
  const { data, error } = await supabase
    .from("lms_settings")
    .select(
      "id, case_id, adapter_type, config, stagnation_days, is_active, created_by, created_at, updated_at"
    )
    .or(`case_id.eq.${caseId},case_id.is.null`)
    .eq("is_active", true)
    .order("case_id", { ascending: false, nullsFirst: false }) // 案件固有 > null(システム全体)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapLmsSetting(data);
}

// ---------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------
function mapSnapshot(row: Record<string, unknown>): LmsProgressSnapshotRow {
  return {
    id:                 String(row["id"]),
    caseId:             String(row["case_id"]),
    participantId:      String(row["participant_id"]),
    syncLogId:          row["sync_log_id"] != null ? String(row["sync_log_id"]) : null,
    lmsUserId:          row["lms_user_id"] != null ? String(row["lms_user_id"]) : null,
    progressRate:       Number(row["progress_rate"]),
    isCompleted:        Boolean(row["is_completed"]),
    lastAccessAt:       row["last_access_at"] != null ? String(row["last_access_at"]) : null,
    totalWatchSeconds:  row["total_watch_seconds"] != null ? Number(row["total_watch_seconds"]) : null,
    rawPayload:         row["raw_payload"] as Record<string, unknown> | null,
    syncedAt:           String(row["synced_at"]),
    createdAt:          String(row["created_at"]),
  };
}

function mapSyncLog(row: Record<string, unknown>): LmsSyncLogRow {
  return {
    id:              String(row["id"]),
    caseId:          String(row["case_id"]),
    adapterType:     String(row["adapter_type"]),
    status:          String(row["status"]) as LmsSyncLogRow["status"],
    triggeredBy:     row["triggered_by"] != null ? String(row["triggered_by"]) : null,
    totalRecords:    row["total_records"] != null ? Number(row["total_records"]) : null,
    successRecords:  row["success_records"] != null ? Number(row["success_records"]) : null,
    errorRecords:    row["error_records"] != null ? Number(row["error_records"]) : null,
    errorDetail:     row["error_detail"] != null ? String(row["error_detail"]) : null,
    sourceFilename:  row["source_filename"] != null ? String(row["source_filename"]) : null,
    startedAt:       String(row["started_at"]),
    finishedAt:      row["finished_at"] != null ? String(row["finished_at"]) : null,
    createdAt:       String(row["created_at"]),
  };
}

function mapLmsSetting(row: Record<string, unknown>): LmsSettingRow {
  return {
    id:             String(row["id"]),
    caseId:         row["case_id"] != null ? String(row["case_id"]) : null,
    adapterType:    String(row["adapter_type"]),
    config:         (row["config"] as Record<string, unknown>) ?? {},
    stagnationDays: Number(row["stagnation_days"]),
    isActive:       Boolean(row["is_active"]),
    createdBy:      row["created_by"] != null ? String(row["created_by"]) : null,
    createdAt:      String(row["created_at"]),
    updatedAt:      String(row["updated_at"]),
  };
}
