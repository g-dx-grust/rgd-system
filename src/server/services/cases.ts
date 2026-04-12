/**
 * 案件サービス
 *
 * 案件作成時の初期タスク自動生成など業務ロジックを担う。
 */

import { listTaskTemplates, bulkCreateTasks } from "@/server/repositories/tasks";

const INITIAL_STATUS             = "case_received";
const POST_ACCEPTANCE_STATUS     = "post_acceptance_processing";

/**
 * 案件作成時の初期タスクを自動生成する。
 *
 * task_templates テーブルから trigger_status = 'case_received' のテンプレートを取得し、
 * 案件に紐づくタスクを一括挿入する。
 *
 * @param caseId     作成された案件 ID
 * @param baseDate   期限計算の基準日（YYYY-MM-DD）。省略時は今日
 */
export async function generateInitialTasks(caseId: string, baseDate?: string): Promise<void> {
  const templates = await listTaskTemplates(INITIAL_STATUS);
  if (templates.length === 0) return;

  const base = baseDate ? new Date(baseDate) : new Date();

  const inputs = templates.map((tpl) => {
    let dueDate: string | undefined;
    if (tpl.dueOffsetDays != null) {
      const d = new Date(base);
      d.setDate(d.getDate() + tpl.dueOffsetDays);
      dueDate = d.toISOString().slice(0, 10);
    }
    return {
      caseId,
      taskTemplateId:  tpl.id,
      title:           tpl.title,
      description:     tpl.description ?? undefined,
      priority:        tpl.priority,
      dueDate,
      generatedByRule: `auto:${INITIAL_STATUS}`,
    };
  });

  await bulkCreateTasks(inputs);
}

/**
 * 受理日登録後のタスクを自動生成する。
 *
 * task_templates テーブルから trigger_status = 'post_acceptance_processing'
 * のテンプレートを取得し、案件に紐づくタスクを一括挿入する。
 *
 * @param caseId       案件 ID
 * @param acceptanceDate 受理日（YYYY-MM-DD）。期限計算の基準日
 */
export async function generatePostAcceptanceTasks(caseId: string, acceptanceDate: string): Promise<void> {
  const templates = await listTaskTemplates(POST_ACCEPTANCE_STATUS);
  if (templates.length === 0) return;

  const base = new Date(acceptanceDate);

  const inputs = templates.map((tpl) => {
    let dueDate: string | undefined;
    if (tpl.dueOffsetDays != null) {
      const d = new Date(base);
      d.setDate(d.getDate() + tpl.dueOffsetDays);
      dueDate = d.toISOString().slice(0, 10);
    }
    return {
      caseId,
      taskTemplateId:  tpl.id,
      title:           tpl.title,
      description:     tpl.description ?? undefined,
      priority:        tpl.priority,
      dueDate,
      generatedByRule: `auto:${POST_ACCEPTANCE_STATUS}`,
    };
  });

  await bulkCreateTasks(inputs);
}

/**
 * Next Best Action を算出する。
 *
 * 優先順位:
 *  1. 期限超過の必須タスク
 *  2. 今日中に実施すべきタスク
 *  3. 未着手の open タスク（priority 順）
 *
 * @returns テキストメッセージ、なければ null
 */
export function computeNextBestAction(
  tasks: Array<{
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
  }>
): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const openTasks = tasks.filter((t) => t.status === "open" || t.status === "in_progress");
  if (openTasks.length === 0) return null;

  // 1. 期限超過タスク
  const overdue = openTasks.filter((t) => {
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < today;
  });
  if (overdue.length > 0) {
    const task = overdue[0];
    return `【期限超過】${task.title}`;
  }

  // 2. 今日中タスク
  const todayStr = today.toISOString().slice(0, 10);
  const todayTasks = openTasks.filter((t) => t.dueDate === todayStr);
  if (todayTasks.length > 0) {
    return `【本日期限】${todayTasks[0].title}`;
  }

  // 3. 優先度順の未着手タスク
  const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  const sorted = [...openTasks].sort(
    (a, b) =>
      (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 0) -
      (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 0)
  );
  if (sorted.length > 0) {
    return sorted[0].title;
  }

  return null;
}
