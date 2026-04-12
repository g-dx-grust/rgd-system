/**
 * 監査ログ リポジトリ
 *
 * 重要操作を audit_logs テーブルに記録する。
 * サーバーサイド（Server Action / Route Handler）限定。
 * クライアントコンポーネントから直接インポートしないこと。
 */

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export type AuditAction =
  | "login"
  | "logout"
  | "login_failed"
  | "password_reset_request"
  | "password_reset_complete"
  | "case_create"
  | "case_update"
  | "case_delete"
  | "case_status_change"
  | "document_upload"
  | "document_view"
  | "document_replace"
  | "document_return"
  | "document_delete"
  | "trainee_update"
  | "specialist_package_create"
  | "billing_status_change"
  | "settings_change"
  | "user_role_change"
  | "user_deactivate"
  | "lms_progress_sync"
  | "bulk_owner_change"
  | "bulk_document_return";

export interface WriteAuditLogParams {
  userId: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 監査ログを書き込む。
 * 失敗してもメイン処理をブロックしないよう、エラーはコンソールに出力するのみ。
 */
export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  try {
    const supabase = await createClient();
    const headersList = await headers();
    const ipAddress = headersList.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? headersList.get("x-real-ip")
      ?? null;
    const userAgent = headersList.get("user-agent") ?? null;

    const { error } = await supabase.from("audit_logs").insert({
      user_id:     params.userId,
      action:      params.action,
      target_type: params.targetType ?? null,
      target_id:   params.targetId   ?? null,
      metadata:    params.metadata   ?? null,
      ip_address:  ipAddress,
      user_agent:  userAgent,
    });

    if (error) {
      console.error("[audit_log] write failed:", error.message);
    }
  } catch (err) {
    console.error("[audit_log] unexpected error:", err);
  }
}

// -----------------------------------------------------------
// 監査ログ 検索・一覧（管理画面用）
// -----------------------------------------------------------

export interface AuditLogRow {
  id: string;
  userId: string | null;
  userDisplayName: string | null;
  action: AuditAction;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface ListAuditLogsFilters {
  action?: AuditAction;
  userId?: string;
  targetType?: string;
  targetId?: string;
  dateFrom?: string;   // ISO date string
  dateTo?: string;     // ISO date string
  page?: number;
  perPage?: number;
}

export interface ListAuditLogsResult {
  logs: AuditLogRow[];
  total: number;
  page: number;
  perPage: number;
}

export async function listAuditLogs(
  filters: ListAuditLogsFilters = {}
): Promise<ListAuditLogsResult> {
  const supabase = await createClient();
  const page    = filters.page    ?? 1;
  const perPage = filters.perPage ?? 50;
  const from    = (page - 1) * perPage;

  let query = supabase
    .from("audit_logs")
    .select(
      `
      id,
      user_id,
      action,
      target_type,
      target_id,
      metadata,
      ip_address,
      created_at,
      user_profiles ( display_name )
      `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + perPage - 1);

  if (filters.action)     query = query.eq("action",      filters.action);
  if (filters.userId)     query = query.eq("user_id",     filters.userId);
  if (filters.targetType) query = query.eq("target_type", filters.targetType);
  if (filters.targetId)   query = query.eq("target_id",   filters.targetId);
  if (filters.dateFrom)   query = query.gte("created_at", `${filters.dateFrom}T00:00:00+09:00`);
  if (filters.dateTo)     query = query.lte("created_at", `${filters.dateTo}T23:59:59+09:00`);

  const { data, error, count } = await query;

  if (error || !data) {
    return { logs: [], total: 0, page, perPage };
  }

  const logs: AuditLogRow[] = data.map((r) => ({
    id:              String(r.id),
    userId:          r.user_id   ? String(r.user_id)   : null,
    userDisplayName: (r.user_profiles as { display_name?: string } | null)?.display_name ?? null,
    action:          r.action    as AuditAction,
    targetType:      r.target_type ? String(r.target_type) : null,
    targetId:        r.target_id   ? String(r.target_id)   : null,
    metadata:        (r.metadata as Record<string, unknown>) ?? null,
    ipAddress:       r.ip_address  ? String(r.ip_address)  : null,
    createdAt:       String(r.created_at),
  }));

  return { logs, total: count ?? 0, page, perPage };
}

// -----------------------------------------------------------
// 案件タイムライン（案件詳細の変更履歴タブ用）
// -----------------------------------------------------------

export interface CaseTimelineEvent {
  id: string;
  action: AuditAction;
  userDisplayName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export async function listCaseTimeline(caseId: string): Promise<CaseTimelineEvent[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      `
      id,
      action,
      metadata,
      created_at,
      user_profiles ( display_name )
      `
    )
    .eq("target_type", "case")
    .eq("target_id", caseId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) return [];

  return data.map((r) => ({
    id:              String(r.id),
    action:          r.action as AuditAction,
    userDisplayName: (r.user_profiles as { display_name?: string } | null)?.display_name ?? null,
    metadata:        (r.metadata as Record<string, unknown>) ?? null,
    createdAt:       String(r.created_at),
  }));
}
