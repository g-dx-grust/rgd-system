/**
 * 運営会社スコープ判定
 *
 * DB の auth_can_access_company() 関数と同じロジックを TypeScript で実装する。
 * Server Action / Route Handler での事前チェックに使用すること。
 * RLS が最終防衛ラインであり、本関数はその手前の早期リターン用。
 *
 * 規則（CLAUDE.md §7.5 / 2026-04-19_修正依頼.md ④ 確定）:
 *   user_profiles.operating_company_id IS NULL → Admin / Operations Manager / Auditor
 *     → 両社横断可
 *   user_profiles.operating_company_id IS NOT NULL → Operations Staff / Sales / Accounting 等
 *     → 自社案件のみアクセス可
 */

import type { RoleCode } from "./permissions";

/** 運営会社スコープ判定に必要なユーザー情報 */
export interface UserCompanyProfile {
  role: RoleCode;
  operatingCompanyId: string | null;
}

export interface CompanyAssignmentValidationResult {
  ok: boolean;
  normalizedOperatingCompanyId: string | null;
  error?: string;
}

export type UserAccessMode =
  | "cross_company"
  | "company_scoped"
  | "external_specialist"
  | "client_portal";

/**
 * ユーザーが指定の運営会社にアクセス可能か判定する。
 * DB の auth_can_access_company(UUID) と同等のロジック。
 *
 * @param user   認証済みユーザーの会社情報
 * @param targetCompanyId  アクセス対象の運営会社 ID
 */
export function canAccessCompany(
  user: UserCompanyProfile,
  targetCompanyId: string | null | undefined
): boolean {
  if (!targetCompanyId) return false;

  // operating_company_id IS NULL = 上位ロール（両社横断）
  if (user.operatingCompanyId === null) return true;

  // 自社一致の場合のみ許可
  return user.operatingCompanyId === targetCompanyId;
}

/** 両社横断アクセス可のロール */
export const CROSS_COMPANY_ROLES: ReadonlySet<RoleCode> = new Set<RoleCode>([
  "admin",
  "operations_manager",
  "auditor",
]);

/** 自社限定ロール */
export const OWN_COMPANY_ROLES: ReadonlySet<RoleCode> = new Set<RoleCode>([
  "operations_staff",
  "sales",
  "accounting",
]);

/**
 * ロールコードから期待される company-scope 設定を返す。
 * ユーザー登録時・バリデーション時のガイドとして使う。
 *
 * @returns "cross" = operating_company_id を NULL にすべきロール
 *          "own"   = operating_company_id を必須設定すべきロール
 *          "other" = 別軸で制御するロール（client_portal_user / external_specialist）
 */
export function companyScope(
  role: RoleCode
): "cross" | "own" | "other" {
  if (CROSS_COMPANY_ROLES.has(role)) return "cross";
  if (OWN_COMPANY_ROLES.has(role)) return "own";
  return "other";
}

export function getUserAccessMode(role: RoleCode): UserAccessMode {
  if (role === "external_specialist") return "external_specialist";
  if (role === "client_portal_user") return "client_portal";
  return companyScope(role) === "cross" ? "cross_company" : "company_scoped";
}

export function getRoleCodesForAccessMode(mode: UserAccessMode): RoleCode[] {
  switch (mode) {
    case "cross_company":
      return ["admin", "operations_manager", "auditor"];
    case "company_scoped":
      return ["operations_staff", "sales", "accounting"];
    case "external_specialist":
      return ["external_specialist"];
    case "client_portal":
      return ["client_portal_user"];
  }
}

/**
 * ロールに応じた運営会社設定を検証し、保存値を正規化する。
 *
 * - cross: 常に NULL を保存
 * - own:   運営会社必須
 * - other: 指定があれば保存、未指定でも可
 */
export function validateOperatingCompanyAssignment(
  role: RoleCode,
  operatingCompanyId: string | null
): CompanyAssignmentValidationResult {
  const scope = companyScope(role);

  if (scope === "cross") {
    return {
      ok: true,
      normalizedOperatingCompanyId: null,
    };
  }

  if (scope === "own" && !operatingCompanyId) {
    return {
      ok: false,
      normalizedOperatingCompanyId: null,
      error: "このロールは所属運営会社の設定が必須です。",
    };
  }

  if (role === "external_specialist" || role === "client_portal_user") {
    return {
      ok: true,
      normalizedOperatingCompanyId: null,
    };
  }

  return {
    ok: true,
    normalizedOperatingCompanyId: operatingCompanyId,
  };
}
