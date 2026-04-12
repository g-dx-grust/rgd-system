/**
 * RBAC 権限定義
 *
 * ロール × 機能のマトリクスで権限を管理する。
 * if 文の乱立を避け、このファイルに集約することで
 * 権限変更を一箇所で管理できる。
 */

// ---------------------------------------------------------------
// ロールコード（DBの roles.code と一致させること）
// ---------------------------------------------------------------
export const ROLES = [
  "admin",
  "operations_manager",
  "operations_staff",
  "sales",
  "accounting",
  "auditor",
  "client_portal_user",
  "external_specialist",
] as const;

export type RoleCode = (typeof ROLES)[number];

// ---------------------------------------------------------------
// 機能権限コード
// ---------------------------------------------------------------
export const PERMISSIONS = {
  // 案件
  CASE_CREATE: "case:create",
  CASE_EDIT: "case:edit",
  CASE_VIEW_ALL: "case:view_all",
  CASE_VIEW_OWN: "case:view_own",
  CASE_STATUS_CHANGE: "case:status_change",
  CASE_DELETE: "case:delete",

  // 顧客企業
  CLIENT_EDIT: "client:edit",

  // 受講者
  TRAINEE_EDIT: "trainee:edit",

  // 書類
  DOCUMENT_UPLOAD: "document:upload",
  DOCUMENT_DELETE: "document:delete",
  DOCUMENT_TYPE_CHANGE: "document:type_change",

  // 社労士連携
  SPECIALIST_PACKAGE_CREATE: "specialist_package:create",

  // 請求
  BILLING_REGISTER: "billing:register",

  // LMS進捗
  LMS_PROGRESS_VIEW: "lms_progress:view",
  LMS_PROGRESS_SYNC: "lms_progress:sync",

  // 設定
  SETTINGS_EDIT: "settings:edit",

  // 監査ログ
  AUDIT_LOG_VIEW: "audit_log:view",

  // ユーザー管理（内部向け）
  USER_MANAGE: "user:manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ---------------------------------------------------------------
// ロール → 権限マトリクス
// ---------------------------------------------------------------
const ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  admin: Object.values(PERMISSIONS) as Permission[],

  operations_manager: [
    PERMISSIONS.CASE_CREATE,
    PERMISSIONS.CASE_EDIT,
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.CASE_VIEW_OWN,
    PERMISSIONS.CASE_STATUS_CHANGE,
    PERMISSIONS.CLIENT_EDIT,
    PERMISSIONS.TRAINEE_EDIT,
    PERMISSIONS.DOCUMENT_UPLOAD,
    PERMISSIONS.DOCUMENT_DELETE,
    PERMISSIONS.DOCUMENT_TYPE_CHANGE,
    PERMISSIONS.SPECIALIST_PACKAGE_CREATE,
    PERMISSIONS.BILLING_REGISTER,
    PERMISSIONS.LMS_PROGRESS_VIEW,
    PERMISSIONS.LMS_PROGRESS_SYNC,
    PERMISSIONS.SETTINGS_EDIT, // 一部
    PERMISSIONS.AUDIT_LOG_VIEW,
  ],

  operations_staff: [
    PERMISSIONS.CASE_CREATE,
    PERMISSIONS.CASE_EDIT,
    PERMISSIONS.CASE_VIEW_OWN,
    PERMISSIONS.CASE_STATUS_CHANGE,
    PERMISSIONS.CLIENT_EDIT,
    PERMISSIONS.TRAINEE_EDIT,
    PERMISSIONS.DOCUMENT_UPLOAD,
    PERMISSIONS.DOCUMENT_TYPE_CHANGE,
    PERMISSIONS.SPECIALIST_PACKAGE_CREATE,
    PERMISSIONS.LMS_PROGRESS_VIEW,
    PERMISSIONS.LMS_PROGRESS_SYNC,
  ],

  sales: [
    PERMISSIONS.CASE_CREATE,
    PERMISSIONS.CASE_VIEW_OWN, // 自担当案件
    PERMISSIONS.CLIENT_EDIT,
    PERMISSIONS.DOCUMENT_UPLOAD,
    PERMISSIONS.LMS_PROGRESS_VIEW,
  ],

  accounting: [
    PERMISSIONS.CASE_VIEW_OWN, // 限定参照
    PERMISSIONS.DOCUMENT_UPLOAD, // 証憑のみ
    PERMISSIONS.BILLING_REGISTER,
    PERMISSIONS.LMS_PROGRESS_VIEW,
  ],

  auditor: [
    PERMISSIONS.CASE_VIEW_ALL,
    PERMISSIONS.LMS_PROGRESS_VIEW,
    PERMISSIONS.AUDIT_LOG_VIEW,
  ],

  client_portal_user: [
    PERMISSIONS.DOCUMENT_UPLOAD, // 指定ファイルのみ
  ],

  external_specialist: [
    PERMISSIONS.SPECIALIST_PACKAGE_CREATE, // 共有パッケージ経由のみ
  ],
};

/**
 * 指定ロールが指定権限を持つか判定する
 */
export function roleHasPermission(role: RoleCode, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * 指定ロールが持つ全権限を返す
 */
export function getPermissionsForRole(role: RoleCode): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
