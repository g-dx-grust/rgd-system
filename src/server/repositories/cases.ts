/**
 * 案件 リポジトリ
 */

import { createClient } from "@/lib/supabase/server";
import type { CaseStatus } from "@/lib/constants/case-status";

export interface CaseRow {
  id: string;
  caseCode: string;
  organizationId: string;
  organizationName: string;
  caseName: string;
  subsidyProgramId: string | null;
  subsidyProgramName: string | null;
  status: CaseStatus;
  contractDate: string | null;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  preApplicationDueDate: string | null;
  finalApplicationDueDate: string | null;
  acceptanceDate: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  /** 集計フィールド */
  participantCount?: number;
  openTaskCount?: number;
  insufficientDocCount?: number;
  nextDueDate?: string | null;
}

export interface CaseListFilters {
  status?: CaseStatus;
  ownerUserId?: string;
  organizationId?: string;
  search?: string;
  page?: number;
  perPage?: number;
  /** 期限超過（pre or final が現在日時より過去）かつ未完了の案件のみ */
  overdueOnly?: boolean;
  /** 7日以上更新がなく未完了の案件のみ */
  stalledOnly?: boolean;
  /** 指定ステータスを除外 */
  excludeStatuses?: CaseStatus[];
}

export interface CaseListResult {
  cases: CaseRow[];
  total: number;
  page: number;
  perPage: number;
}

export interface CreateCaseInput {
  organizationId: string;
  caseName: string;
  subsidyProgramId?: string;
  contractDate?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  preApplicationDueDate?: string;
  finalApplicationDueDate?: string;
  ownerUserId?: string;
  summary?: string;
  createdBy: string;
}

export interface UpdateCaseInput {
  caseName?: string;
  subsidyProgramId?: string;
  contractDate?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  preApplicationDueDate?: string;
  finalApplicationDueDate?: string;
  ownerUserId?: string;
  summary?: string;
}

// ---------------------------------------------------------------
// 案件一覧（フィルタ・ページネーション）
// ---------------------------------------------------------------
export async function listCases(filters: CaseListFilters = {}): Promise<CaseListResult> {
  const supabase = await createClient();
  const page    = filters.page    ?? 1;
  const perPage = filters.perPage ?? 20;
  const offset  = (page - 1) * perPage;

  let query = supabase
    .from("cases")
    .select(
      `
      id, case_code, case_name, status,
      contract_date, planned_start_date, planned_end_date,
      pre_application_due_date, final_application_due_date,
      acceptance_date, owner_user_id, summary, created_at, updated_at,
      organization_id,
      organizations ( legal_name ),
      subsidy_program_id,
      subsidy_programs ( name )
      `,
      { count: "exact" }
    )
    .is("deleted_at", null);

  if (filters.status)         query = query.eq("status", filters.status);
  if (filters.ownerUserId)    query = query.eq("owner_user_id", filters.ownerUserId);
  if (filters.organizationId) query = query.eq("organization_id", filters.organizationId);
  if (filters.search) {
    query = query.or(`case_name.ilike.%${filters.search}%,case_code.ilike.%${filters.search}%`);
  }
  if (filters.excludeStatuses?.length) {
    query = query.not("status", "in", `(${filters.excludeStatuses.join(",")})`);
  }
  if (filters.overdueOnly) {
    const now = new Date().toISOString();
    query = query
      .or(`pre_application_due_date.lt.${now},final_application_due_date.lt.${now}`)
      .not("status", "in", "(completed,cancelled)");
  }
  if (filters.stalledOnly) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query
      .lt("updated_at", sevenDaysAgo)
      .not("status", "in", "(completed,cancelled)");
  }

  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const caseIds = rows.map((r) => String(r["id"]));

  // owner_user_id → display_name マップを別クエリで取得
  const ownerUserIds = [...new Set(
    rows.map((r) => r["owner_user_id"]).filter((id): id is string => !!id)
  )];
  const ownerNameMap = await fetchOwnerNameMap(supabase, ownerUserIds);

  // 補足情報を一括取得
  const [docSummaryMap, taskCountMap] = caseIds.length > 0
    ? await Promise.all([
        fetchDocSummaryMap(supabase, caseIds),
        fetchOpenTaskCountMap(supabase, caseIds),
      ])
    : [new Map<string, number>(), new Map<string, number>()];

  return {
    cases: rows.map((r) => {
      const base = mapCase(r, ownerNameMap);
      base.insufficientDocCount = docSummaryMap.get(base.id) ?? 0;
      base.openTaskCount        = taskCountMap.get(base.id) ?? 0;
      // 次回期限: pre と final のうち未来で近い方
      base.nextDueDate          = nearestFutureDue(base.preApplicationDueDate, base.finalApplicationDueDate);
      return base;
    }),
    total: count ?? 0,
    page,
    perPage,
  };
}

// ---------------------------------------------------------------
// 補足情報取得ヘルパー
// ---------------------------------------------------------------

type SupabaseClient = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

/** owner_user_id → display_name のマップを user_profiles から取得 */
async function fetchOwnerNameMap(
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

async function fetchDocSummaryMap(
  supabase: SupabaseClient,
  caseIds: string[]
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("case_document_summary")
    .select("case_id, insufficient_count")
    .in("case_id", caseIds);

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    map.set(String(row["case_id"]), Number(row["insufficient_count"] ?? 0));
  }
  return map;
}

async function fetchOpenTaskCountMap(
  supabase: SupabaseClient,
  caseIds: string[]
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("tasks")
    .select("case_id")
    .in("case_id", caseIds)
    .in("status", ["open", "in_progress"])
    .is("deleted_at", null);

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const id = String(row["case_id"]);
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

function nearestFutureDue(a: string | null, b: string | null): string | null {
  const now = Date.now();
  const candidates = [a, b]
    .filter((d): d is string => !!d)
    .filter((d) => new Date(d).getTime() >= now)
    .sort((x, y) => new Date(x).getTime() - new Date(y).getTime());
  return candidates[0] ?? null;
}

// ---------------------------------------------------------------
// 案件詳細
// ---------------------------------------------------------------
export async function getCase(id: string): Promise<CaseRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cases")
    .select(
      `
      id, case_code, case_name, status,
      contract_date, planned_start_date, planned_end_date,
      pre_application_due_date, final_application_due_date,
      acceptance_date, owner_user_id, summary, created_at, updated_at,
      organization_id,
      organizations ( legal_name ),
      subsidy_program_id,
      subsidy_programs ( name )
      `
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;

  const ownerUserIds = data["owner_user_id"] ? [String(data["owner_user_id"])] : [];
  const ownerNameMap = await fetchOwnerNameMap(supabase, ownerUserIds);
  return mapCase(data, ownerNameMap);
}

// ---------------------------------------------------------------
// 案件作成
// ---------------------------------------------------------------
export async function createCase(input: CreateCaseInput): Promise<CaseRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cases")
    .insert({
      organization_id:           input.organizationId,
      case_name:                 input.caseName,
      subsidy_program_id:        input.subsidyProgramId ?? null,
      status:                    "case_received",
      contract_date:             input.contractDate ?? null,
      planned_start_date:        input.plannedStartDate ?? null,
      planned_end_date:          input.plannedEndDate ?? null,
      pre_application_due_date:  input.preApplicationDueDate ?? null,
      final_application_due_date:input.finalApplicationDueDate ?? null,
      owner_user_id:             input.ownerUserId ?? null,
      summary:                   input.summary ?? null,
      created_by:                input.createdBy,
    })
    .select(
      `
      id, case_code, case_name, status,
      contract_date, planned_start_date, planned_end_date,
      pre_application_due_date, final_application_due_date,
      acceptance_date, owner_user_id, summary, created_at, updated_at,
      organization_id,
      organizations ( legal_name ),
      subsidy_program_id,
      subsidy_programs ( name )
      `
    )
    .single();

  if (error || !data) throw new Error(error?.message ?? "案件の作成に失敗しました");

  const ownerUserIds = data["owner_user_id"] ? [String(data["owner_user_id"])] : [];
  const ownerNameMap = await fetchOwnerNameMap(supabase, ownerUserIds);
  return mapCase(data, ownerNameMap);
}

// ---------------------------------------------------------------
// 案件更新
// ---------------------------------------------------------------
export async function updateCase(id: string, input: UpdateCaseInput): Promise<void> {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};
  if (input.caseName              !== undefined) updates["case_name"]                  = input.caseName;
  if (input.subsidyProgramId      !== undefined) updates["subsidy_program_id"]         = input.subsidyProgramId;
  if (input.contractDate          !== undefined) updates["contract_date"]              = input.contractDate;
  if (input.plannedStartDate      !== undefined) updates["planned_start_date"]         = input.plannedStartDate;
  if (input.plannedEndDate        !== undefined) updates["planned_end_date"]           = input.plannedEndDate;
  if (input.preApplicationDueDate !== undefined) updates["pre_application_due_date"]   = input.preApplicationDueDate;
  if (input.finalApplicationDueDate !== undefined) updates["final_application_due_date"] = input.finalApplicationDueDate;
  if (input.ownerUserId           !== undefined) updates["owner_user_id"]              = input.ownerUserId;
  if (input.summary               !== undefined) updates["summary"]                    = input.summary;

  const { error } = await supabase
    .from("cases")
    .update(updates)
    .eq("id", id)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------
// ステータス変更
// ---------------------------------------------------------------
export async function updateCaseStatus(id: string, status: CaseStatus): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cases")
    .update({ status })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------
// 論理削除
// ---------------------------------------------------------------
export async function deleteCase(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cases")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------
function mapCase(row: Record<string, unknown>, ownerNameMap?: Map<string, string>): CaseRow {
  const org = row["organizations"];
  const sp  = row["subsidy_programs"];
  const ownerUserId = row["owner_user_id"] != null ? String(row["owner_user_id"]) : null;

  return {
    id:                      String(row["id"]),
    caseCode:                String(row["case_code"]),
    organizationId:          String(row["organization_id"]),
    organizationName:        org && typeof org === "object" && "legal_name" in org
      ? String((org as Record<string, unknown>)["legal_name"]) : "",
    caseName:                String(row["case_name"]),
    subsidyProgramId:        row["subsidy_program_id"] != null ? String(row["subsidy_program_id"]) : null,
    subsidyProgramName:      sp && typeof sp === "object" && "name" in sp
      ? String((sp as Record<string, unknown>)["name"]) : null,
    status:                  String(row["status"]) as CaseStatus,
    contractDate:            row["contract_date"] != null ? String(row["contract_date"]) : null,
    plannedStartDate:        row["planned_start_date"] != null ? String(row["planned_start_date"]) : null,
    plannedEndDate:          row["planned_end_date"] != null ? String(row["planned_end_date"]) : null,
    preApplicationDueDate:   row["pre_application_due_date"] != null ? String(row["pre_application_due_date"]) : null,
    finalApplicationDueDate: row["final_application_due_date"] != null ? String(row["final_application_due_date"]) : null,
    acceptanceDate:          row["acceptance_date"] != null ? String(row["acceptance_date"]) : null,
    ownerUserId,
    ownerName:               ownerUserId && ownerNameMap ? (ownerNameMap.get(ownerUserId) ?? null) : null,
    summary:                 row["summary"] != null ? String(row["summary"]) : null,
    createdAt:               String(row["created_at"]),
    updatedAt:               String(row["updated_at"]),
  };
}
