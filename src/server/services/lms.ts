/**
 * LMS サービス
 *
 * - 停滞判定
 * - 進捗ステータス分類
 * - 完了率算出
 */

import type { LmsProgressSnapshotRow } from "@/server/repositories/lms";

/** 受講者の進捗分類 */
export type ProgressStatus =
  | "completed"    // 完了
  | "in_progress"  // 進行中（直近アクセスあり）
  | "stagnant"     // 停滞（N日以上アクセスなし）
  | "not_started"; // 未着手（アクセス実績なし）

export interface ClassifiedProgress {
  snapshot: LmsProgressSnapshotRow;
  progressStatus: ProgressStatus;
  /** 停滞日数（not_started / in_progress の場合は null）*/
  stagnantDays: number | null;
}

/**
 * スナップショット一覧を進捗ステータスで分類する。
 * @param snapshots  受講者ごとの最新スナップショット
 * @param stagnationDays  停滞とみなす日数（デフォルト 7日）
 */
export function classifyProgress(
  snapshots: LmsProgressSnapshotRow[],
  stagnationDays = 7
): ClassifiedProgress[] {
  const now = Date.now();
  const stagnationMs = stagnationDays * 24 * 60 * 60 * 1000;

  return snapshots.map((s) => {
    if (s.isCompleted) {
      return { snapshot: s, progressStatus: "completed", stagnantDays: null };
    }

    if (!s.lastAccessAt) {
      return { snapshot: s, progressStatus: "not_started", stagnantDays: null };
    }

    const lastMs = new Date(s.lastAccessAt).getTime();
    const diffMs = now - lastMs;

    if (diffMs > stagnationMs) {
      const stagnantDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      return { snapshot: s, progressStatus: "stagnant", stagnantDays };
    }

    return { snapshot: s, progressStatus: "in_progress", stagnantDays: null };
  });
}

/** 案件全体の完了率（0〜100）を算出する */
export function calcCompletionRate(snapshots: LmsProgressSnapshotRow[]): number {
  if (snapshots.length === 0) return 0;
  const completed = snapshots.filter((s) => s.isCompleted).length;
  return Math.round((completed / snapshots.length) * 100);
}

/** 進捗ステータスのラベル */
export const PROGRESS_STATUS_LABELS: Record<ProgressStatus, string> = {
  completed:   "完了",
  in_progress: "進行中",
  stagnant:    "停滞",
  not_started: "未着手",
};
