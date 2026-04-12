/**
 * セッション・ユーザープロフィール取得ヘルパー
 *
 * Server Component / Server Action / Route Handler から呼び出す。
 * クライアントコンポーネントからは使用しないこと。
 */

import { createClient } from "@/lib/supabase/server";
import type { RoleCode } from "@/lib/rbac";

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  roleCode: RoleCode;
  roleLabel: string;
  isActive: boolean;
  organizationId: string | null;
}

/**
 * 現在のセッションを取得する。
 * 未認証の場合は null を返す。
 */
export async function getSession() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/**
 * 現在のユーザーの auth.User を取得する。
 * 未認証の場合は null を返す。
 * getUser() はトークン検証付きのため getSession より安全。
 */
export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * 現在のユーザープロフィール（ロール情報付き）を取得する。
 * 未認証または profile 未作成の場合は null を返す。
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      `
      id,
      display_name,
      email,
      is_active,
      roles (
        code,
        label_ja
      )
    `
    )
    .eq("id", user.id)
    .single();

  if (error || !data) return null;

  const role = Array.isArray(data.roles) ? data.roles[0] : data.roles;

  return {
    id: data.id,
    displayName: data.display_name,
    email: data.email,
    roleCode: role?.code as RoleCode,
    roleLabel: role?.label_ja ?? "",
    isActive: data.is_active,
    organizationId: null, // organizations テーブル migration 適用後に有効化
  };
}
