/**
 * 保存フィルタ リポジトリ
 *
 * ユーザーがよく使うフィルタ条件を保存・読込する。
 * サーバーサイド限定。
 */

import { createClient } from "@/lib/supabase/server";

export interface SavedFilter {
  id: string;
  userId: string;
  name: string;
  scope: string;
  filterParams: Record<string, unknown>;
  isDefault: boolean;
  createdAt: string;
}

export async function listSavedFilters(userId: string, scope: string): Promise<SavedFilter[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_filters")
    .select("*")
    .eq("user_id", userId)
    .eq("scope", scope)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map(toSavedFilter);
}

export async function getSavedFilterById(id: string): Promise<SavedFilter | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_filters")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return toSavedFilter(data);
}

export interface CreateSavedFilterInput {
  userId: string;
  name: string;
  scope: string;
  filterParams: Record<string, unknown>;
  isDefault?: boolean;
}

export async function createSavedFilter(input: CreateSavedFilterInput): Promise<SavedFilter | null> {
  const supabase = await createClient();

  // isDefault=true にする場合、既存のデフォルトを外す
  if (input.isDefault) {
    await supabase
      .from("saved_filters")
      .update({ is_default: false })
      .eq("user_id", input.userId)
      .eq("scope", input.scope)
      .eq("is_default", true);
  }

  const { data, error } = await supabase
    .from("saved_filters")
    .insert({
      user_id:       input.userId,
      name:          input.name,
      scope:         input.scope,
      filter_params: input.filterParams,
      is_default:    input.isDefault ?? false,
    })
    .select()
    .single();

  if (error || !data) return null;
  return toSavedFilter(data);
}

export async function deleteSavedFilter(id: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("saved_filters")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);  // 所有者確認（RLSの補強）

  return !error;
}

export async function setDefaultSavedFilter(id: string, userId: string, scope: string): Promise<boolean> {
  const supabase = await createClient();

  // 既存デフォルトを外す
  await supabase
    .from("saved_filters")
    .update({ is_default: false })
    .eq("user_id", userId)
    .eq("scope", scope)
    .eq("is_default", true);

  const { error } = await supabase
    .from("saved_filters")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", userId);

  return !error;
}

// -----------------------------------------------------------
// マッパー
// -----------------------------------------------------------
function toSavedFilter(r: Record<string, unknown>): SavedFilter {
  return {
    id:           String(r.id),
    userId:       String(r.user_id),
    name:         String(r.name),
    scope:        String(r.scope),
    filterParams: (r.filter_params as Record<string, unknown>) ?? {},
    isDefault:    Boolean(r.is_default),
    createdAt:    String(r.created_at),
  };
}
