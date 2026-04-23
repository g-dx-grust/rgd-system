/**
 * 案件 リポジトリ
 */

import { createClient } from "@/lib/supabase/server";
import {
  isOperatingCompanyUuid,
  normalizeOperatingCompanyCode,
} from "@/server/repositories/operating-companies";
import {
  isMissingSupabaseColumnError,
  isMissingSupabaseRelationError,
} from "@/lib/supabase/errors";
import type { CaseStatus } from "@/lib/constants/case-status";

export interface CaseRow {
  id: string;
  caseCode: string;
  organizationId: string;
  organizationName: string;
  caseName: string;
  subsidyProgramId: string | null;
  subsidyProgramName: string | null;
  videoCourseId: string | null;
  videoCourseName: string | null;
  operatingCompanyId: string;
  operatingCompanyName: string;
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
  operatingCompanyId?: string;
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
  operatingCompanyId: string;
  caseName: string;
  subsidyProgramId?: string;
  videoCourseId?: string;
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
  videoCourseId?: string | null;
  contractDate?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  preApplicationDueDate?: string;
  finalApplicationDueDate?: string;
  ownerUserId?: string;
  summary?: string;
}

const CASE_SELECT_FIELDS = `
  id, case_code, case_name, status,
  contract_date, planned_start_date, planned_end_date,
  pre_application_due_date, final_application_due_date,
  acceptance_date, owner_user_id, summary, created_at, updated_at,
  organization_id,
  subsidy_program_id,
  video_course_id,
  operating_company_id
`;

const CASE_SELECT_FIELDS_LEGACY = `
  id, case_code, case_name, status,
  contract_date, planned_start_date, planned_end_date,
  pre_application_due_date, final_application_due_date,
  acceptance_date, owner_user_id, summary, created_at, updated_at,
  organization_id,
  subsidy_program_id
`;

type CaseQueryResult = {
  data: Record<string, unknown>[] | null;
  error: { message?: string | null } | null;
  count: number | null;
};

type CaseSingleQueryResult = {
  data: Record<string, unknown> | null;
  error: { message?: string | null } | null;
};

type CaseLookupMaps = {
  ownerNames: Map<string, string>;
  organizationNames: Map<string, string>;
  subsidyProgramNames: Map<string, string>;
  videoCourseNames: Map<string, string>;
  operatingCompanyNames: Map<string, string>;
};

function hasOptionalCaseColumnError(error: unknown): boolean {
  return isMissingSupabaseColumnError(error, [
    "video_course_id",
    "operating_company_id",
  ]);
}

function buildListCasesQuery(
  supabase: SupabaseClient,
  filters: CaseListFilters,
  selectFields: string,
  supportsOperatingCompanyFilter: boolean
) {
  let query = supabase
    .from("cases")
    .select(selectFields, { count: "exact" })
    .is("deleted_at", null);

  if (filters.status)             query = query.eq("status", filters.status);
  if (filters.ownerUserId)        query = query.eq("owner_user_id", filters.ownerUserId);
  if (filters.organizationId)     query = query.eq("organization_id", filters.organizationId);
  if (supportsOperatingCompanyFilter && filters.operatingCompanyId) {
    query = query.eq("operating_company_id", filters.operatingCompanyId);
  }
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

  return query;
}

async function executeListCasesQuery(
  supabase: SupabaseClient,
  filters: CaseListFilters,
  offset: number,
  perPage: number
): Promise<CaseQueryResult> {
  let result = await buildListCasesQuery(supabase, filters, CASE_SELECT_FIELDS, true)
    .order("updated_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (result.error && hasOptionalCaseColumnError(result.error)) {
    result = await buildListCasesQuery(
      supabase,
      filters,
      CASE_SELECT_FIELDS_LEGACY,
      false
    )
      .order("updated_at", { ascending: false })
      .range(offset, offset + perPage - 1);
  }

  return {
    data: (result.data as Record<string, unknown>[] | null) ?? null,
    error: result.error,
    count: result.count ?? null,
  };
}

async function executeSingleCaseQuery(
  supabase: SupabaseClient,
  id: string
): Promise<CaseSingleQueryResult> {
  let result = await supabase
    .from("cases")
    .select(CASE_SELECT_FIELDS)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (result.error && hasOptionalCaseColumnError(result.error)) {
    result = await supabase
      .from("cases")
      .select(CASE_SELECT_FIELDS_LEGACY)
      .eq("id", id)
      .is("deleted_at", null)
      .single();
  }

  return {
    data: (result.data as Record<string, unknown> | null) ?? null,
    error: result.error,
  };
}

// ---------------------------------------------------------------
// 案件一覧（フィルタ・ページネーション）
// ---------------------------------------------------------------
export async function listCases(filters: CaseListFilters = {}): Promise<CaseListResult> {
  const supabase = await createClient();
  const page    = filters.page    ?? 1;
  const perPage = filters.perPage ?? 20;
  const offset  = (page - 1) * perPage;

  const { data, error, count } = await executeListCasesQuery(
    supabase,
    filters,
    offset,
    perPage
  );

  if (error) throw new Error(error.message ?? "案件一覧の取得に失敗しました");

  const rows = data ?? [];
  const caseIds = rows.map((r) => String(r["id"]));
  const lookupMaps = await fetchCaseLookupMaps(supabase, rows);

  // 補足情報を一括取得
  const [docSummaryMap, taskCountMap] = caseIds.length > 0
    ? await Promise.all([
        fetchDocSummaryMap(supabase, caseIds),
        fetchOpenTaskCountMap(supabase, caseIds),
      ])
    : [new Map<string, number>(), new Map<string, number>()];

  return {
    cases: rows.map((r) => {
      const base = mapCase(r, lookupMaps);
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

async function fetchCaseLookupMaps(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[]
): Promise<CaseLookupMaps> {
  const ownerUserIds = [...new Set(
    rows.map((r) => r["owner_user_id"]).filter((id): id is string => !!id)
  )];
  const organizationIds = [...new Set(
    rows.map((r) => r["organization_id"]).filter((id): id is string => !!id)
  )];
  const subsidyProgramIds = [...new Set(
    rows.map((r) => r["subsidy_program_id"]).filter((id): id is string => !!id)
  )];
  const videoCourseIds = [...new Set(
    rows.map((r) => r["video_course_id"]).filter((id): id is string => !!id)
  )];
  const operatingCompanyIds = [...new Set(
    rows.map((r) => r["operating_company_id"]).filter((id): id is string => !!id)
  )];

  const [
    ownerNames,
    organizationNames,
    subsidyProgramNames,
    videoCourseNames,
    operatingCompanyNames,
  ] = await Promise.all([
    fetchOwnerNameMap(supabase, ownerUserIds),
    fetchOrganizationNameMap(supabase, organizationIds),
    fetchSubsidyProgramNameMap(supabase, subsidyProgramIds),
    fetchVideoCourseNameMap(supabase, videoCourseIds),
    fetchOperatingCompanyNameMap(supabase, operatingCompanyIds),
  ]);

  return {
    ownerNames,
    organizationNames,
    subsidyProgramNames,
    videoCourseNames,
    operatingCompanyNames,
  };
}

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

async function fetchOrganizationNameMap(
  supabase: SupabaseClient,
  organizationIds: string[]
): Promise<Map<string, string>> {
  if (organizationIds.length === 0) return new Map();

  const { data } = await supabase
    .from("organizations")
    .select("id, legal_name")
    .in("id", organizationIds);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row["id"] && row["legal_name"]) {
      map.set(String(row["id"]), String(row["legal_name"]));
    }
  }
  return map;
}

async function fetchSubsidyProgramNameMap(
  supabase: SupabaseClient,
  subsidyProgramIds: string[]
): Promise<Map<string, string>> {
  if (subsidyProgramIds.length === 0) return new Map();

  const { data } = await supabase
    .from("subsidy_programs")
    .select("id, name")
    .in("id", subsidyProgramIds);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row["id"] && row["name"]) {
      map.set(String(row["id"]), String(row["name"]));
    }
  }
  return map;
}

async function fetchVideoCourseNameMap(
  supabase: SupabaseClient,
  videoCourseIds: string[]
): Promise<Map<string, string>> {
  if (videoCourseIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("video_courses")
    .select("id, name")
    .in("id", videoCourseIds);

  if (error) {
    if (isMissingSupabaseRelationError(error, ["video_courses"])) {
      return new Map();
    }
    throw new Error(error.message);
  }

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row["id"] && row["name"]) {
      map.set(String(row["id"]), String(row["name"]));
    }
  }
  return map;
}

async function fetchOperatingCompanyNameMap(
  supabase: SupabaseClient,
  operatingCompanyIds: string[]
): Promise<Map<string, string>> {
  if (operatingCompanyIds.length === 0) return new Map();

  const uniqueKeys = [...new Set(
    operatingCompanyIds.map((value) => value.trim()).filter((value) => value.length > 0)
  )];
  const uuidKeys = uniqueKeys.filter(isOperatingCompanyUuid);
  const codeKeys = uniqueKeys
    .filter((value) => !isOperatingCompanyUuid(value))
    .map(normalizeOperatingCompanyCode);

  const map = new Map<string, string>();
  const appendRows = (rows: Array<Record<string, unknown>> | null) => {
    for (const row of rows ?? []) {
      const name = row["name"];
      if (!name) continue;

      if (row["id"]) {
        map.set(String(row["id"]), String(name));
      }
      if (row["code"]) {
        map.set(String(row["code"]), String(name));
      }
    }
  };

  if (uuidKeys.length > 0) {
    const { data, error } = await supabase
      .from("operating_companies")
      .select("id, code, name")
      .in("id", uuidKeys);

    if (error) {
      if (isMissingSupabaseRelationError(error, ["operating_companies"])) {
        return new Map();
      }
      throw new Error(error.message);
    }

    appendRows((data as Array<Record<string, unknown>> | null) ?? null);
  }

  if (codeKeys.length > 0) {
    const { data, error } = await supabase
      .from("operating_companies")
      .select("id, code, name")
      .in("code", codeKeys);

    if (error) {
      if (isMissingSupabaseRelationError(error, ["operating_companies"])) {
        return new Map();
      }
      throw new Error(error.message);
    }

    appendRows((data as Array<Record<string, unknown>> | null) ?? null);
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

  const { data, error } = await executeSingleCaseQuery(supabase, id);

  if (error || !data) return null;

  const lookupMaps = await fetchCaseLookupMaps(supabase, [data]);
  return mapCase(data, lookupMaps);
}

// ---------------------------------------------------------------
// 案件作成
// ---------------------------------------------------------------
export async function createCase(input: CreateCaseInput): Promise<CaseRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cases")
    .insert({
      organization_id:            input.organizationId,
      operating_company_id:       input.operatingCompanyId,
      case_name:                  input.caseName,
      subsidy_program_id:         input.subsidyProgramId ?? null,
      video_course_id:            input.videoCourseId ?? null,
      status:                     "case_received",
      contract_date:              input.contractDate ?? null,
      planned_start_date:         input.plannedStartDate ?? null,
      planned_end_date:           input.plannedEndDate ?? null,
      pre_application_due_date:   input.preApplicationDueDate ?? null,
      final_application_due_date: input.finalApplicationDueDate ?? null,
      owner_user_id:              input.ownerUserId ?? null,
      summary:                    input.summary ?? null,
      created_by:                 input.createdBy,
    })
    .select(CASE_SELECT_FIELDS)
    .single();

  if (error || !data) throw new Error(error?.message ?? "案件の作成に失敗しました");

  const lookupMaps = await fetchCaseLookupMaps(supabase, [data as Record<string, unknown>]);
  return mapCase(data as Record<string, unknown>, lookupMaps);
}

// ---------------------------------------------------------------
// 案件更新
// ---------------------------------------------------------------
export async function updateCase(id: string, input: UpdateCaseInput): Promise<void> {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};
  if (input.caseName              !== undefined) updates["case_name"]                  = input.caseName;
  if (input.subsidyProgramId      !== undefined) updates["subsidy_program_id"]         = input.subsidyProgramId;
  if (input.videoCourseId         !== undefined) updates["video_course_id"]            = input.videoCourseId;
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
function mapCase(
  row: Record<string, unknown>,
  lookupMaps: CaseLookupMaps
): CaseRow {
  const ownerUserId = row["owner_user_id"] != null ? String(row["owner_user_id"]) : null;
  const organizationId = row["organization_id"] != null ? String(row["organization_id"]) : "";
  const subsidyProgramId = row["subsidy_program_id"] != null ? String(row["subsidy_program_id"]) : null;
  const videoCourseId = row["video_course_id"] != null ? String(row["video_course_id"]) : null;
  const operatingCompanyId = row["operating_company_id"] != null
    ? String(row["operating_company_id"])
    : "";
  const videoCourseName = videoCourseId
    ? (lookupMaps.videoCourseNames.get(videoCourseId) ?? null)
    : null;
  const subsidyProgramName = subsidyProgramId
    ? (lookupMaps.subsidyProgramNames.get(subsidyProgramId) ?? null)
    : null;
  const operatingCompanyName = operatingCompanyId
    ? (lookupMaps.operatingCompanyNames.get(operatingCompanyId) ?? "")
    : "";

  return {
    id:                      String(row["id"]),
    caseCode:                String(row["case_code"]),
    organizationId,
    organizationName:        lookupMaps.organizationNames.get(organizationId) ?? "",
    caseName:                row["case_name"] != null ? String(row["case_name"]) : "",
    subsidyProgramId,
    subsidyProgramName,
    videoCourseId,
    videoCourseName,
    operatingCompanyId,
    operatingCompanyName,
    status:                  String(row["status"]) as CaseStatus,
    contractDate:            row["contract_date"] != null ? String(row["contract_date"]) : null,
    plannedStartDate:        row["planned_start_date"] != null ? String(row["planned_start_date"]) : null,
    plannedEndDate:          row["planned_end_date"] != null ? String(row["planned_end_date"]) : null,
    preApplicationDueDate:   row["pre_application_due_date"] != null ? String(row["pre_application_due_date"]) : null,
    finalApplicationDueDate: row["final_application_due_date"] != null ? String(row["final_application_due_date"]) : null,
    acceptanceDate:          row["acceptance_date"] != null ? String(row["acceptance_date"]) : null,
    ownerUserId,
    ownerName:               ownerUserId ? (lookupMaps.ownerNames.get(ownerUserId) ?? null) : null,
    summary:                 row["summary"] != null ? String(row["summary"]) : null,
    createdAt:               String(row["created_at"]),
    updatedAt:               String(row["updated_at"]),
  };
}
