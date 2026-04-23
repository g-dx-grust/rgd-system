/**
 * ユーザー リポジトリ
 *
 * user_profiles + roles の取得・更新。
 * サーバーサイド限定。
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RoleCode } from "@/lib/rbac";
import {
  isOperatingCompanyUuid,
  normalizeOperatingCompanyCode,
} from "@/server/repositories/operating-companies";
import {
  isMissingSupabaseColumnError,
  isMissingSupabaseRelationError,
} from "@/lib/supabase/errors";

export interface UserRow {
  id: string;
  displayName: string;
  email: string;
  roleCode: RoleCode | null;
  roleLabel: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  operatingCompanyId: string | null;
  operatingCompanyName: string | null;
  hasProfile: boolean;
}

export interface RoleOption {
  id: string;
  code: RoleCode;
  labelJa: string;
  sortOrder: number;
}

export interface SpecialistUserOption {
  id: string;
  displayName: string;
  email: string;
}

/**
 * 全ユーザー一覧を取得（論理削除除く。無効化ユーザーも含む）
 * Admin のみ呼び出し可。呼び出し元で権限チェックを行うこと。
 */
export async function listUsers(): Promise<UserRow[]> {
  const supabase = await createClient();

  const primaryResult = await supabase
    .from("user_profiles")
    .select(
      `
      id,
      display_name,
      email,
      is_active,
      created_at,
      operating_company_id,
      roles (
        code,
        label_ja
      )
    `
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  let data: Record<string, unknown>[] = [];

  if (
    primaryResult.error &&
    isMissingSupabaseColumnError(primaryResult.error, ["operating_company_id"])
  ) {
    const fallbackResult = await supabase
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

    if (fallbackResult.error) throw new Error(fallbackResult.error.message);
    data = (fallbackResult.data as Record<string, unknown>[] | null) ?? [];
  } else {
    if (primaryResult.error) throw new Error(primaryResult.error.message);
    data = (primaryResult.data as Record<string, unknown>[] | null) ?? [];
  }
  const operatingCompanyNameMap = await fetchOperatingCompanyNameMap(
    data
      .map((row) => {
        return row["operating_company_id"] != null
          ? String(row["operating_company_id"])
          : null;
      })
      .filter((id): id is string => !!id)
  );

  const lastLoginMap = await fetchLastLoginMap(
    data.map((row) => String(row.id))
  );

  const profileUsers: UserRow[] = data.map((row) => {
    const roleRelation = row["roles"];
    const role = Array.isArray(roleRelation) ? roleRelation[0] : roleRelation;
    const roleRecord =
      role && typeof role === "object"
        ? (role as Record<string, unknown>)
        : null;
    const operatingCompanyId =
      row["operating_company_id"] != null
        ? String(row["operating_company_id"])
        : null;
    return {
      id: String(row["id"]),
      displayName: String(row["display_name"]),
      email: String(row["email"]),
      roleCode: roleRecord?.["code"] as RoleCode,
      roleLabel:
        roleRecord?.["label_ja"] != null ? String(roleRecord["label_ja"]) : "",
      isActive: Boolean(row["is_active"]),
      createdAt: String(row["created_at"]),
      lastLoginAt: lastLoginMap.get(String(row["id"])) ?? null,
      operatingCompanyId,
      operatingCompanyName: operatingCompanyId
        ? (operatingCompanyNameMap.get(String(operatingCompanyId)) ?? null)
        : null,
      hasProfile: true,
    };
  });

  const authUsers = await fetchAuthUsers();
  if (authUsers.length === 0) {
    return profileUsers;
  }

  const profileUserMap = new Map(profileUsers.map((user) => [user.id, user]));

  for (const authUser of authUsers) {
    if (profileUserMap.has(authUser.id)) continue;

    profileUserMap.set(authUser.id, {
      id: authUser.id,
      displayName: authUser.displayName,
      email: authUser.email,
      roleCode: null,
      roleLabel: "未設定",
      isActive: authUser.isActive,
      createdAt: authUser.createdAt,
      lastLoginAt: authUser.lastLoginAt,
      operatingCompanyId: null,
      operatingCompanyName: null,
      hasProfile: false,
    });
  }

  return [...profileUserMap.values()].sort((left, right) => {
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

/**
 * 有効な社労士アカウント一覧を取得する。
 * 申請タブ/終了申請タブの共有先選択で使用する。
 */
export async function listExternalSpecialists(): Promise<SpecialistUserOption[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("user_profiles")
    .select(`
      id,
      display_name,
      email,
      roles!inner ( code )
    `)
    .eq("roles.code", "external_specialist")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("display_name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: String(row["id"]),
    displayName: String(row["display_name"]),
    email: String(row["email"]),
  }));
}

async function fetchOperatingCompanyNameMap(
  operatingCompanyIds: string[]
): Promise<Map<string, string>> {
  if (operatingCompanyIds.length === 0) return new Map();

  const supabase = await createClient();
  const uniqueKeys = [...new Set(
    operatingCompanyIds.map((value) => value.trim()).filter((value) => value.length > 0)
  )];
  const uuidKeys = uniqueKeys.filter(isOperatingCompanyUuid);
  const codeKeys = uniqueKeys
    .filter((value) => !isOperatingCompanyUuid(value))
    .map(normalizeOperatingCompanyCode);

  const map = new Map<string, string>();
  const appendRows = (rows: Array<Record<string, unknown>> | null) => {
    for (const row of rows ?? []) {
      const name = row["name"];
      if (!name) continue;

      if (row["id"]) {
        map.set(String(row["id"]), String(name));
      }
      if (row["code"]) {
        map.set(String(row["code"]), String(name));
      }
    }
  };

  if (uuidKeys.length > 0) {
    const { data, error } = await supabase
      .from("operating_companies")
      .select("id, code, name")
      .in("id", uuidKeys);

    if (error) {
      if (isMissingSupabaseRelationError(error, ["operating_companies"])) {
        return new Map();
      }
      throw new Error(error.message);
    }

    appendRows((data as Array<Record<string, unknown>> | null) ?? null);
  }

  if (codeKeys.length > 0) {
    const { data, error } = await supabase
      .from("operating_companies")
      .select("id, code, name")
      .in("code", codeKeys);

    if (error) {
      if (isMissingSupabaseRelationError(error, ["operating_companies"])) {
        return new Map();
      }
      throw new Error(error.message);
    }

    appendRows((data as Array<Record<string, unknown>> | null) ?? null);
  }

  return map;
}

async function fetchLastLoginMap(userIds: string[]): Promise<Map<string, string | null>> {
  if (userIds.length === 0) return new Map();

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) {
      console.error("[users] failed to fetch auth users:", error.message);
      return new Map();
    }

    const map = new Map<string, string | null>();
    for (const user of data.users ?? []) {
      if (userIds.includes(user.id)) {
        map.set(user.id, user.last_sign_in_at ?? null);
      }
    }
    return map;
  } catch (error) {
    console.error("[users] unexpected auth user fetch error:", error);
    return new Map();
  }
}

interface AuthUserSummary {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  lastLoginAt: string | null;
  isActive: boolean;
}

async function fetchAuthUsers(): Promise<AuthUserSummary[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) {
      console.error("[users] failed to fetch auth users:", error.message);
      return [];
    }

    const now = Date.now();

    return (data.users ?? []).map((user) => {
      const rawDisplayName = user.user_metadata?.display_name;
      const displayName =
        typeof rawDisplayName === "string" && rawDisplayName.trim().length > 0
          ? rawDisplayName.trim()
          : (user.email?.split("@")[0] ?? "未設定ユーザー");
      const bannedUntil = typeof user.banned_until === "string"
        ? new Date(user.banned_until).getTime()
        : null;

      return {
        id: user.id,
        email: user.email ?? "",
        displayName,
        createdAt: user.created_at,
        lastLoginAt: user.last_sign_in_at ?? null,
        isActive: bannedUntil == null || Number.isNaN(bannedUntil) || bannedUntil <= now,
      };
    });
  } catch (error) {
    console.error("[users] unexpected auth user fetch error:", error);
    return [];
  }
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
export async function updateUserAccess(
  userId: string,
  input: {
    roleId: string;
    operatingCompanyId: string | null;
  }
): Promise<void> {
  // Admin-only write path. The action layer already enforces permissions,
  // so we use the service role here to avoid coupling user management to RLS.
  const supabase = createAdminClient();
  const authUser = await fetchAuthUserById(userId);
  if (!authUser) {
    throw new Error("対象ユーザーが認証ユーザー一覧に見つかりません。");
  }

  let { error } = await supabase.from("user_profiles").upsert(
    {
      id: userId,
      email: authUser.email,
      display_name: authUser.displayName,
      role_id: input.roleId,
      operating_company_id: input.operatingCompanyId,
      is_active: authUser.isActive,
    },
    { onConflict: "id" }
  );

  if (error && isMissingSupabaseColumnError(error, ["operating_company_id"])) {
    const fallbackResult = await supabase.from("user_profiles").upsert(
      {
        id: userId,
        email: authUser.email,
        display_name: authUser.displayName,
        role_id: input.roleId,
        is_active: authUser.isActive,
      },
      { onConflict: "id" }
    );
    error = fallbackResult.error;
  }

  if (error) throw new Error(error.message);
}

/**
 * Supabase Auth にユーザーを作成し、auth user ID を返す。
 * サービスロールキーが必要（サーバーサイド限定）。
 */
export async function createSupabaseAuthUser(
  email: string,
  password: string,
  displayName?: string
): Promise<string> {
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata:
      displayName && displayName.trim().length > 0
        ? { display_name: displayName.trim() }
        : undefined,
  });

  if (error) throw new Error(error.message);
  return data.user.id;
}

/**
 * user_profiles にプロフィールを作成する。
 */
export async function createUserProfile(params: {
  authUserId: string;
  email: string;
  displayName: string;
  roleId: string;
  operatingCompanyId: string | null;
}): Promise<void> {
  // Admin-only write path. The action layer already enforces permissions,
  // so we use the service role here to avoid coupling user management to RLS.
  const supabase = createAdminClient();

  let { error } = await supabase.from("user_profiles").upsert(
    {
      id: params.authUserId,
      email: params.email,
      display_name: params.displayName,
      role_id: params.roleId,
      operating_company_id: params.operatingCompanyId ?? null,
      is_active: true,
    },
    { onConflict: "id" }
  );

  if (error && isMissingSupabaseColumnError(error, ["operating_company_id"])) {
    const fallbackResult = await supabase.from("user_profiles").upsert(
      {
        id: params.authUserId,
        email: params.email,
        display_name: params.displayName,
        role_id: params.roleId,
        is_active: true,
      },
      { onConflict: "id" }
    );
    error = fallbackResult.error;
  }

  if (error) throw new Error(error.message);
}

/**
 * ユーザーを無効化（is_active = false のみ。deleted_at は設定しない = 再有効化可能）。
 */
export async function deactivateUser(userId: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("user_profiles")
    .update({ is_active: false })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  // Supabase Auth 側でもバン（99999h ≒ 永続停止）
  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(userId, { ban_duration: "99999h" });
}

/**
 * ユーザーを有効化（停止解除）。
 */
export async function activateUser(userId: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("user_profiles")
    .update({ is_active: true })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  // Supabase Auth 側のバンを解除
  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
}

/**
 * 管理者が対象ユーザーのパスワードを再設定する。
 */
export async function resetUserPassword(
  userId: string,
  password: string
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) throw new Error(error.message);
}

async function fetchAuthUserById(userId: string): Promise<AuthUserSummary | null> {
  const authUsers = await fetchAuthUsers();
  return authUsers.find((user) => user.id === userId) ?? null;
}
