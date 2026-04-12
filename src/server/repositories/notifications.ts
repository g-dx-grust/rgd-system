/**
 * 通知 リポジトリ
 *
 * アプリ内通知の読み書き・既読管理。
 * サーバーサイド限定。
 */

import { createClient } from "@/lib/supabase/server";

export type NotificationCategory = "info" | "warning" | "error" | "task";

export interface NotificationRow {
  id: string;
  userId: string;
  title: string;
  body: string;
  linkUrl: string | null;
  category: NotificationCategory;
  isRead: boolean;
  readAt: string | null;
  caseId: string | null;
  createdAt: string;
}

export interface ListNotificationsOptions {
  userId: string;
  unreadOnly?: boolean;
  page?: number;
  perPage?: number;
}

export interface ListNotificationsResult {
  notifications: NotificationRow[];
  total: number;
  unreadCount: number;
}

export async function listNotifications(
  opts: ListNotificationsOptions
): Promise<ListNotificationsResult> {
  const supabase = await createClient();
  const page    = opts.page    ?? 1;
  const perPage = opts.perPage ?? 30;
  const from    = (page - 1) * perPage;

  let query = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", opts.userId)
    .order("created_at", { ascending: false })
    .range(from, from + perPage - 1);

  if (opts.unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, error, count } = await query;

  // 未読数カウント（全件、フィルタに関わらず）
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", opts.userId)
    .eq("is_read", false);

  if (error || !data) {
    return { notifications: [], total: 0, unreadCount: unreadCount ?? 0 };
  }

  return {
    notifications: data.map(toNotificationRow),
    total:         count ?? 0,
    unreadCount:   unreadCount ?? 0,
  };
}

export async function markNotificationRead(id: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  return !error;
}

export async function markAllNotificationsRead(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_read", false);
  return !error;
}

/** 通知を作成する（システム内部から呼び出す） */
export interface CreateNotificationInput {
  userId: string;
  title: string;
  body?: string;
  linkUrl?: string;
  category?: NotificationCategory;
  caseId?: string;
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("notifications").insert({
      user_id:  input.userId,
      title:    input.title,
      body:     input.body ?? "",
      link_url: input.linkUrl ?? null,
      category: input.category ?? "info",
      case_id:  input.caseId ?? null,
    });
    if (error) {
      console.error("[notifications] create failed:", error.message);
    }
  } catch (err) {
    console.error("[notifications] unexpected error:", err);
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  return count ?? 0;
}

// -----------------------------------------------------------
// マッパー
// -----------------------------------------------------------
function toNotificationRow(r: Record<string, unknown>): NotificationRow {
  return {
    id:        String(r.id),
    userId:    String(r.user_id),
    title:     String(r.title),
    body:      String(r.body ?? ""),
    linkUrl:   r.link_url  ? String(r.link_url)  : null,
    category:  (r.category as NotificationCategory) ?? "info",
    isRead:    Boolean(r.is_read),
    readAt:    r.read_at   ? String(r.read_at)   : null,
    caseId:    r.case_id   ? String(r.case_id)   : null,
    createdAt: String(r.created_at),
  };
}
