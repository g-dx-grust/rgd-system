/**
 * タスク リポジトリ
 */

import { createClient } from "@/lib/supabase/server";

export interface TaskRow {
  id: string;
  caseId: string;
  taskTemplateId: string | null;
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'done' | 'skipped';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigneeUserId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  generatedByRule: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskTemplateRow {
  id: string;
  triggerStatus: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueOffsetDays: number | null;
  sortOrder: number;
}

export interface CreateTaskInput {
  caseId: string;
  taskTemplateId?: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  assigneeUserId?: string;
  dueDate?: string;
  generatedByRule?: string;
}

export interface UpdateTaskInput {
  status?: 'open' | 'in_progress' | 'done' | 'skipped';
  assigneeUserId?: string;
  dueDate?: string;
}

// ---------------------------------------------------------------
// ユーザー名取得ヘルパー
// ---------------------------------------------------------------
type SupabaseClient = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

async function fetchUserNameMap(
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

// ---------------------------------------------------------------
// 案件のタスク一覧
// ---------------------------------------------------------------
export async function listTasks(caseId: string): Promise<TaskRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select(
      `
      id, case_id, task_template_id, title, description,
      status, priority, assignee_user_id, due_date,
      generated_by_rule, completed_at, created_at, updated_at
      `
    )
    .eq("case_id", caseId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const userIds = [...new Set(
    rows.map((r) => r["assignee_user_id"]).filter((id): id is string => !!id)
  )];
  const nameMap = await fetchUserNameMap(supabase, userIds);
  return rows.map((r) => mapTask(r, nameMap));
}

// ---------------------------------------------------------------
// タスクテンプレート取得（トリガーステータスで絞込）
// ---------------------------------------------------------------
export async function listTaskTemplates(triggerStatus: string): Promise<TaskTemplateRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("task_templates")
    .select("id, trigger_status, title, description, priority, due_offset_days, sort_order")
    .eq("trigger_status", triggerStatus)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id:             String(row["id"]),
    triggerStatus:  String(row["trigger_status"]),
    title:          String(row["title"]),
    description:    row["description"] != null ? String(row["description"]) : null,
    priority:       String(row["priority"]) as TaskTemplateRow["priority"],
    dueOffsetDays:  row["due_offset_days"] != null ? Number(row["due_offset_days"]) : null,
    sortOrder:      Number(row["sort_order"]),
  }));
}

// ---------------------------------------------------------------
// タスク作成（1件）
// ---------------------------------------------------------------
export async function createTask(input: CreateTaskInput): Promise<TaskRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      case_id:           input.caseId,
      task_template_id:  input.taskTemplateId ?? null,
      title:             input.title,
      description:       input.description ?? null,
      priority:          input.priority ?? "medium",
      assignee_user_id:  input.assigneeUserId ?? null,
      due_date:          input.dueDate ?? null,
      generated_by_rule: input.generatedByRule ?? null,
    })
    .select(
      `
      id, case_id, task_template_id, title, description,
      status, priority, assignee_user_id, due_date,
      generated_by_rule, completed_at, created_at, updated_at
      `
    )
    .single();

  if (error || !data) throw new Error(error?.message ?? "タスクの作成に失敗しました");

  const userIds = data["assignee_user_id"] ? [String(data["assignee_user_id"])] : [];
  const nameMap = await fetchUserNameMap(supabase, userIds);
  return mapTask(data, nameMap);
}

// ---------------------------------------------------------------
// タスク一括作成
// ---------------------------------------------------------------
export async function bulkCreateTasks(inputs: CreateTaskInput[]): Promise<void> {
  const supabase = await createClient();

  const inserts = inputs.map((input) => ({
    case_id:           input.caseId,
    task_template_id:  input.taskTemplateId ?? null,
    title:             input.title,
    description:       input.description ?? null,
    priority:          input.priority ?? "medium",
    assignee_user_id:  input.assigneeUserId ?? null,
    due_date:          input.dueDate ?? null,
    generated_by_rule: input.generatedByRule ?? null,
  }));

  const { error } = await supabase.from("tasks").insert(inserts);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------
// タスク更新
// ---------------------------------------------------------------
export async function updateTask(id: string, input: UpdateTaskInput): Promise<void> {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};
  if (input.status          !== undefined) updates["status"]           = input.status;
  if (input.assigneeUserId  !== undefined) updates["assignee_user_id"] = input.assigneeUserId;
  if (input.dueDate         !== undefined) updates["due_date"]         = input.dueDate;

  if (input.status === "done") {
    updates["completed_at"] = new Date().toISOString();
  }

  const { error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id);

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------
// 未完了タスク数
// ---------------------------------------------------------------
export async function countOpenTasks(caseId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId)
    .in("status", ["open", "in_progress"]);

  if (error) return 0;
  return count ?? 0;
}

// ---------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------
function mapTask(row: Record<string, unknown>, nameMap?: Map<string, string>): TaskRow {
  const assigneeUserId = row["assignee_user_id"] != null ? String(row["assignee_user_id"]) : null;
  return {
    id:              String(row["id"]),
    caseId:          String(row["case_id"]),
    taskTemplateId:  row["task_template_id"] != null ? String(row["task_template_id"]) : null,
    title:           String(row["title"]),
    description:     row["description"] != null ? String(row["description"]) : null,
    status:          String(row["status"]) as TaskRow["status"],
    priority:        String(row["priority"]) as TaskRow["priority"],
    assigneeUserId,
    assigneeName:    assigneeUserId && nameMap ? (nameMap.get(assigneeUserId) ?? null) : null,
    dueDate:         row["due_date"] != null ? String(row["due_date"]) : null,
    generatedByRule: row["generated_by_rule"] != null ? String(row["generated_by_rule"]) : null,
    completedAt:     row["completed_at"] != null ? String(row["completed_at"]) : null,
    createdAt:       String(row["created_at"]),
    updatedAt:       String(row["updated_at"]),
  };
}
