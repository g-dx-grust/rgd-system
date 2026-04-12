/**
 * ダッシュボード リポジトリ
 *
 * KPI集計・滞留案件・期限超過書類の取得。
 * サーバーサイド限定。
 */

import { createClient } from "@/lib/supabase/server";
import type { CaseStatus } from "@/lib/constants/case-status";

// -----------------------------------------------------------
// KPI サマリー
// -----------------------------------------------------------
export interface DashboardKpi {
  activeCases: number;
  completedThisMonth: number;
  stuckCases: number;
  overdueCases: number;
}

export async function getDashboardKpi(): Promise<DashboardKpi> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_dashboard_kpi")
    .select("*")
    .single();

  if (error || !data) {
    return { activeCases: 0, completedThisMonth: 0, stuckCases: 0, overdueCases: 0 };
  }

  return {
    activeCases:        Number(data.active_cases         ?? 0),
    completedThisMonth: Number(data.completed_this_month ?? 0),
    stuckCases:         Number(data.stuck_cases          ?? 0),
    overdueCases:       Number(data.overdue_cases        ?? 0),
  };
}

// -----------------------------------------------------------
// ステータス別件数
// -----------------------------------------------------------
export interface StatusCount {
  status: CaseStatus;
  count: number;
}

export async function getCaseCountByStatus(): Promise<StatusCount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cases")
    .select("status")
    .is("deleted_at", null);

  if (error || !data) return [];

  const map: Record<string, number> = {};
  for (const row of data) {
    map[row.status] = (map[row.status] ?? 0) + 1;
  }

  return Object.entries(map).map(([status, count]) => ({
    status: status as CaseStatus,
    count,
  }));
}

// -----------------------------------------------------------
// 滞留案件（7日以上更新なし）
// -----------------------------------------------------------
export interface StalledCase {
  id: string;
  caseCode: string;
  caseName: string;
  status: CaseStatus;
  organizationName: string;
  ownerName: string | null;
  stalledDays: number;
  preApplicationDueDate: string | null;
  finalApplicationDueDate: string | null;
}

export async function getStalledCases(limit = 10): Promise<StalledCase[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_stalled_cases")
    .select("*")
    .limit(limit);

  if (error || !data) return [];

  return data.map((r) => ({
    id:                     String(r.id),
    caseCode:               String(r.case_code),
    caseName:               String(r.case_name),
    status:                 r.status as CaseStatus,
    organizationName:       String(r.organization_name ?? ""),
    ownerName:              r.owner_name ? String(r.owner_name) : null,
    stalledDays:            Number(r.stalled_days ?? 0),
    preApplicationDueDate:  r.pre_application_due_date  ? String(r.pre_application_due_date)  : null,
    finalApplicationDueDate: r.final_application_due_date ? String(r.final_application_due_date) : null,
  }));
}

// -----------------------------------------------------------
// 期限超過書類要求
// -----------------------------------------------------------
export interface OverdueDocRequirement {
  id: string;
  caseId: string;
  caseCode: string;
  caseName: string;
  documentTypeName: string;
  dueDate: string;
  overdueDays: number;
}

export async function getOverdueDocRequirements(limit = 10): Promise<OverdueDocRequirement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_overdue_doc_requirements")
    .select("*")
    .limit(limit);

  if (error || !data) return [];

  return data.map((r) => ({
    id:               String(r.id),
    caseId:           String(r.case_id),
    caseCode:         String(r.case_code),
    caseName:         String(r.case_name),
    documentTypeName: String(r.document_type_name),
    dueDate:          String(r.due_date),
    overdueDays:      Number(r.overdue_days ?? 0),
  }));
}

// -----------------------------------------------------------
// 自分向けKPI（担当案件のタスク期限等）
// -----------------------------------------------------------
export interface MyDashboardData {
  todayTaskCount: number;
  overdueTaskCount: number;
  myActiveCaseCount: number;
}

export async function getMyDashboardData(userId: string): Promise<MyDashboardData> {
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);

  const [todayTasks, overdueTasks, myCases] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assignee_user_id", userId)
      .eq("due_date", today)
      .in("status", ["open", "in_progress"]),

    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assignee_user_id", userId)
      .lt("due_date", today)
      .in("status", ["open", "in_progress"]),

    supabase
      .from("cases")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", userId)
      .is("deleted_at", null)
      .not("status", "in", "(completed,cancelled)"),
  ]);

  return {
    todayTaskCount:    todayTasks.count  ?? 0,
    overdueTaskCount:  overdueTasks.count ?? 0,
    myActiveCaseCount: myCases.count     ?? 0,
  };
}
