/**
 * ユーザー リポジトリ
 *
 * user_profiles + roles の取得・更新。
 * サーバーサイド限定。
 */

import { createClient } from "@/lib/supabase/server";
import type { RoleCode } from "@/lib/rbac";

export interface UserRow {
  id: string;
  displayName: string;
  email: string;
  roleCode: RoleCode;
  roleLabel: string;
  isActive: boolean;
  createdAt: string;
}

export interface RoleOption {
  id: string;
  code: RoleCode;
  labelJa: string;
  sortOrder: number;
}

/**
 * 全ユーザー一覧を取得（論理削除除く）
 * Admin のみ呼び出し可。呼び出し元で権限チェックを行うこと。
 */
export async function listUsers(): Promise<UserRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      `
      id,
      display_name,
      email,
      is_active,
      created_at,
      roles (
        code,
        label_ja
      )
    `
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return {
      id: row.id,
      displayName: row.display_name,
      email: row.email,
      roleCode: role?.code as RoleCode,
      roleLabel: role?.label_ja ?? "",
      isActive: row.is_active,
      createdAt: row.created_at,
    };
  });
}

/**
 * ロール一覧を取得
 */
export async function listRoles(): Promise<RoleOption[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("roles")
    .select("id, code, label_ja, sort_order")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id,
    code: r.code as RoleCode,
    labelJa: r.label_ja,
    sortOrder: r.sort_order,
  }));
}

/**
 * ユーザーのロールを変更する
 * Admin のみ呼び出し可。呼び出し元で権限チェックを行うこと。
 */
export async function updateUserRole(
  userId: string,
  roleId: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("user_profiles")
    .update({ role_id: roleId })
    .eq("id", userId);

  if (error) throw new Error(error.message);
}

/**
 * ユーザーを無効化（論理削除）
 * Admin のみ呼び出し可。呼び出し元で権限チェックを行うこと。
 */
export async function deactivateUser(userId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("user_profiles")
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) throw new Error(error.message);
}
