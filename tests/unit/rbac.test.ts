import { describe, it, expect } from "vitest";
import {
  can,
  canAny,
  canAll,
  roleHasPermission,
  getPermissionsForRole,
  PERMISSIONS,
  ROLES,
} from "@/lib/rbac";

describe("roleHasPermission", () => {
  it("admin はすべての権限を持つ", () => {
    for (const permission of Object.values(PERMISSIONS)) {
      expect(roleHasPermission("admin", permission)).toBe(true);
    }
  });

  it("auditor は全案件閲覧権限を持つ", () => {
    expect(roleHasPermission("auditor", PERMISSIONS.CASE_VIEW_ALL)).toBe(true);
  });

  it("auditor は案件作成権限を持たない", () => {
    expect(roleHasPermission("auditor", PERMISSIONS.CASE_CREATE)).toBe(false);
  });

  it("auditor は監査ログ閲覧権限を持つ", () => {
    expect(roleHasPermission("auditor", PERMISSIONS.AUDIT_LOG_VIEW)).toBe(true);
  });

  it("client_portal_user は書類アップロードのみ可能", () => {
    expect(
      roleHasPermission("client_portal_user", PERMISSIONS.DOCUMENT_UPLOAD)
    ).toBe(true);
    expect(
      roleHasPermission("client_portal_user", PERMISSIONS.CASE_CREATE)
    ).toBe(false);
    expect(
      roleHasPermission("client_portal_user", PERMISSIONS.CASE_VIEW_ALL)
    ).toBe(false);
    expect(
      roleHasPermission("client_portal_user", PERMISSIONS.CASE_EDIT)
    ).toBe(false);
  });

  it("external_specialist は社労士パッケージ作成のみ可能", () => {
    expect(
      roleHasPermission(
        "external_specialist",
        PERMISSIONS.SPECIALIST_PACKAGE_CREATE
      )
    ).toBe(true);
    expect(
      roleHasPermission("external_specialist", PERMISSIONS.CASE_CREATE)
    ).toBe(false);
    expect(
      roleHasPermission("external_specialist", PERMISSIONS.DOCUMENT_UPLOAD)
    ).toBe(false);
  });

  it("operations_staff は案件削除権限を持たない", () => {
    expect(
      roleHasPermission("operations_staff", PERMISSIONS.CASE_DELETE)
    ).toBe(false);
  });

  it("operations_staff はユーザー管理権限を持たない", () => {
    expect(
      roleHasPermission("operations_staff", PERMISSIONS.USER_MANAGE)
    ).toBe(false);
  });

  it("accounting は請求登録権限を持つ", () => {
    expect(
      roleHasPermission("accounting", PERMISSIONS.BILLING_REGISTER)
    ).toBe(true);
  });

  it("sales はユーザー管理権限を持たない", () => {
    expect(roleHasPermission("sales", PERMISSIONS.USER_MANAGE)).toBe(false);
  });
});

describe("can", () => {
  it("null ロールは false を返す", () => {
    expect(can(null, PERMISSIONS.CASE_CREATE)).toBe(false);
  });

  it("undefined ロールは false を返す", () => {
    expect(can(undefined, PERMISSIONS.CASE_CREATE)).toBe(false);
  });

  it("admin はどの権限でも true を返す", () => {
    for (const permission of Object.values(PERMISSIONS)) {
      expect(can("admin", permission)).toBe(true);
    }
  });

  it("権限がないロールは false を返す", () => {
    expect(can("auditor", PERMISSIONS.CASE_CREATE)).toBe(false);
  });
});

describe("canAny", () => {
  it("権限リストのいずれかが一致すれば true", () => {
    expect(
      canAny("auditor", [PERMISSIONS.CASE_CREATE, PERMISSIONS.CASE_VIEW_ALL])
    ).toBe(true);
  });

  it("権限リストがすべて不一致なら false", () => {
    expect(
      canAny("auditor", [PERMISSIONS.CASE_CREATE, PERMISSIONS.CASE_DELETE])
    ).toBe(false);
  });

  it("null ロールは false を返す", () => {
    expect(canAny(null, [PERMISSIONS.CASE_VIEW_ALL])).toBe(false);
  });

  it("空の権限リストは false を返す", () => {
    expect(canAny("admin", [])).toBe(false);
  });
});

describe("canAll", () => {
  it("admin はすべての権限を保持する", () => {
    expect(canAll("admin", Object.values(PERMISSIONS))).toBe(true);
  });

  it("auditor が持たない権限が含まれると false", () => {
    expect(
      canAll("auditor", [PERMISSIONS.CASE_VIEW_ALL, PERMISSIONS.CASE_CREATE])
    ).toBe(false);
  });

  it("null ロールは false を返す", () => {
    expect(canAll(null, [PERMISSIONS.CASE_VIEW_ALL])).toBe(false);
  });

  it("空の権限リストは true を返す（全部満たしている）", () => {
    expect(canAll("auditor", [])).toBe(true);
  });
});

describe("getPermissionsForRole", () => {
  it("admin の権限リストはすべての PERMISSIONS を含む", () => {
    const adminPerms = getPermissionsForRole("admin");
    for (const permission of Object.values(PERMISSIONS)) {
      expect(adminPerms).toContain(permission);
    }
  });

  it("各ロールの権限は PERMISSIONS の値のサブセット", () => {
    const allPermissions = new Set(Object.values(PERMISSIONS));
    for (const role of ROLES) {
      const perms = getPermissionsForRole(role);
      for (const p of perms) {
        expect(allPermissions.has(p)).toBe(true);
      }
    }
  });

  it("auditor の権限リストに CASE_CREATE が含まれない", () => {
    expect(getPermissionsForRole("auditor")).not.toContain(
      PERMISSIONS.CASE_CREATE
    );
  });
});
