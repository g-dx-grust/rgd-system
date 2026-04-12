"use server";

/**
 * LMS 同期 Server Actions
 *
 * フロー:
 * 1. 権限確認
 * 2. 同期ログ作成（status: running）
 * 3. Adapter でパース
 * 4. 受講者の lms_user_id マッピング（email 照合）
 * 5. スナップショット一括追記
 * 6. 同期ログ更新（status: success / partial / failed）
 * 7. 監査ログ記録
 */

import { revalidatePath } from "next/cache";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import { createLmsAdapter } from "@/lib/lms/factory";
import {
  createSyncLog,
  updateSyncLog,
  bulkInsertProgressSnapshots,
  getLmsSetting,
} from "@/server/repositories/lms";
import { listParticipants } from "@/server/repositories/participants";
import { writeAuditLog } from "@/server/repositories/audit-log";
import type { InsertProgressSnapshotInput } from "@/server/repositories/lms";

export interface SyncActionResult {
  error?: string;
  success?: boolean;
  syncLogId?: string;
  totalRecords?: number;
  successRecords?: number;
  errorRecords?: number;
  errors?: Array<{ row: number; message: string }>;
}

// ---------------------------------------------------------------
// CSV取込による LMS進捗同期
// ---------------------------------------------------------------
export async function syncLmsProgressAction(
  _prev: SyncActionResult | null,
  formData: FormData
): Promise<SyncActionResult> {
  const user = await getCurrentUserProfile();
  if (!user) return { error: "認証が必要です。" };

  requirePermission(user.roleCode, PERMISSIONS.LMS_PROGRESS_SYNC);

  const caseId = String(formData.get("caseId") ?? "").trim();
  if (!caseId) return { error: "案件IDが不正です。" };

  const file = formData.get("csvFile") as File | null;
  if (!file || file.size === 0) return { error: "CSVファイルを選択してください。" };

  // ファイル種別チェック
  const isValidMime =
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel" ||
    file.name.toLowerCase().endsWith(".csv");
  if (!isValidMime) return { error: "CSVファイル（.csv）のみ対応しています。" };

  const setting = await getLmsSetting(caseId);
  const adapterType = setting?.adapterType ?? "csv";

  // 同期ログ作成（running）
  const syncLog = await createSyncLog({
    caseId,
    adapterType,
    triggeredBy: user.id,
    sourceFilename: file.name,
  });

  try {
    const csvContent = await file.text();
    const adapter    = createLmsAdapter(adapterType);
    const result     = await adapter.fetchProgress(csvContent);

    // 受講者一覧（email で lms_user_id を照合）
    const participants = await listParticipants(caseId);
    const emailToParticipant = new Map(
      participants.map((p) => [p.email?.toLowerCase() ?? "", p])
    );

    const snapshots: InsertProgressSnapshotInput[] = [];
    const unmatchedErrors: Array<{ row: number; message: string }> = [];

    result.records.forEach((rec, idx) => {
      const participant =
        emailToParticipant.get(rec.lmsUserId.toLowerCase()) ?? null;

      if (!participant) {
        unmatchedErrors.push({
          row:     idx + 2,
          message: `受講者が見つかりません: ${rec.lmsUserId}`,
        });
        return;
      }

      snapshots.push({
        caseId,
        participantId:      participant.id,
        syncLogId:          syncLog.id,
        lmsUserId:          rec.lmsUserId,
        progressRate:       rec.progressRate,
        isCompleted:        rec.isCompleted,
        lastAccessAt:       rec.lastAccessAt?.toISOString() ?? null,
        totalWatchSeconds:  rec.totalWatchSeconds,
        rawPayload:         rec.rawPayload,
      });
    });

    await bulkInsertProgressSnapshots(snapshots);

    const allErrors = [...result.errors, ...unmatchedErrors];
    const status =
      snapshots.length === 0 ? "failed" :
      allErrors.length > 0   ? "partial" : "success";

    await updateSyncLog(syncLog.id, {
      status,
      totalRecords:   result.totalRecords,
      successRecords: snapshots.length,
      errorRecords:   allErrors.length,
      errorDetail:    allErrors.length > 0
        ? allErrors.map((e) => `行${e.row}: ${e.message}`).join("\n")
        : undefined,
      finishedAt: new Date().toISOString(),
    });

    await writeAuditLog({
      userId:     user.id,
      action:     "lms_progress_sync",
      targetType: "case",
      targetId:   caseId,
      metadata:   {
        syncLogId:      syncLog.id,
        status,
        totalRecords:   result.totalRecords,
        successRecords: snapshots.length,
        errorRecords:   allErrors.length,
      },
    });

    revalidatePath(`/cases/${caseId}/lms`);

    return {
      success:        true,
      syncLogId:      syncLog.id,
      totalRecords:   result.totalRecords,
      successRecords: snapshots.length,
      errorRecords:   allErrors.length,
      errors:         allErrors,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    await updateSyncLog(syncLog.id, {
      status:         "failed",
      totalRecords:   0,
      successRecords: 0,
      errorRecords:   0,
      errorDetail:    message,
      finishedAt:     new Date().toISOString(),
    });
    return { error: message };
  }
}
