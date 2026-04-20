import { describe, it, expect } from "vitest";
import {
  canAccessCompany,
  companyScope,
  CROSS_COMPANY_ROLES,
  getRoleCodesForAccessMode,
  getUserAccessMode,
  OWN_COMPANY_ROLES,
  validateOperatingCompanyAssignment,
  type UserCompanyProfile,
} from "@/lib/rbac/company-scope";

const GRAST_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const AIM_ID   = "bbbbbbbb-0000-0000-0000-000000000002";

// ---------------------------------------------------------------
// canAccessCompany
// ---------------------------------------------------------------

describe("canAccessCompany — 自社案件は見える", () => {
  it("operations_staff (GRAST) は GRAST 案件を参照できる", () => {
    const user: UserCompanyProfile = {
      role: "operations_staff",
      operatingCompanyId: GRAST_ID,
    };
    expect(canAccessCompany(user, GRAST_ID)).toBe(true);
  });

  it("sales (AIM) は AIM 案件を参照できる", () => {
    const user: UserCompanyProfile = {
      role: "sales",
      operatingCompanyId: AIM_ID,
    };
    expect(canAccessCompany(user, AIM_ID)).toBe(true);
  });

  it("accounting (AIM) は AIM 案件を参照できる", () => {
    const user: UserCompanyProfile = {
      role: "accounting",
      operatingCompanyId: AIM_ID,
    };
    expect(canAccessCompany(user, AIM_ID)).toBe(true);
  });
});

describe("canAccessCompany — 他社案件は見えない", () => {
  it("operations_staff (GRAST) は AIM 案件を参照できない", () => {
    const user: UserCompanyProfile = {
      role: "operations_staff",
      operatingCompanyId: GRAST_ID,
    };
    expect(canAccessCompany(user, AIM_ID)).toBe(false);
  });

  it("sales (AIM) は GRAST 案件を参照できない", () => {
    const user: UserCompanyProfile = {
      role: "sales",
      operatingCompanyId: AIM_ID,
    };
    expect(canAccessCompany(user, GRAST_ID)).toBe(false);
  });

  it("accounting (GRAST) は AIM 案件を参照できない", () => {
    const user: UserCompanyProfile = {
      role: "accounting",
      operatingCompanyId: GRAST_ID,
    };
    expect(canAccessCompany(user, AIM_ID)).toBe(false);
  });
});

describe("canAccessCompany — Admin は両社横断可", () => {
  it("admin (operatingCompanyId: null) は GRAST 案件を参照できる", () => {
    const user: UserCompanyProfile = { role: "admin", operatingCompanyId: null };
    expect(canAccessCompany(user, GRAST_ID)).toBe(true);
  });

  it("admin (operatingCompanyId: null) は AIM 案件を参照できる", () => {
    const user: UserCompanyProfile = { role: "admin", operatingCompanyId: null };
    expect(canAccessCompany(user, AIM_ID)).toBe(true);
  });

  it("operations_manager (operatingCompanyId: null) は両社横断可", () => {
    const user: UserCompanyProfile = {
      role: "operations_manager",
      operatingCompanyId: null,
    };
    expect(canAccessCompany(user, GRAST_ID)).toBe(true);
    expect(canAccessCompany(user, AIM_ID)).toBe(true);
  });

  it("auditor (operatingCompanyId: null) は両社横断可", () => {
    const user: UserCompanyProfile = {
      role: "auditor",
      operatingCompanyId: null,
    };
    expect(canAccessCompany(user, GRAST_ID)).toBe(true);
    expect(canAccessCompany(user, AIM_ID)).toBe(true);
  });
});

describe("canAccessCompany — エッジケース", () => {
  it("targetCompanyId が null の場合は false", () => {
    const user: UserCompanyProfile = { role: "admin", operatingCompanyId: null };
    expect(canAccessCompany(user, null)).toBe(false);
  });

  it("targetCompanyId が undefined の場合は false", () => {
    const user: UserCompanyProfile = { role: "admin", operatingCompanyId: null };
    expect(canAccessCompany(user, undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------
// companyScope
// ---------------------------------------------------------------

describe("companyScope — 両社横断ロール", () => {
  it("admin は cross", () => {
    expect(companyScope("admin")).toBe("cross");
  });
  it("operations_manager は cross", () => {
    expect(companyScope("operations_manager")).toBe("cross");
  });
  it("auditor は cross", () => {
    expect(companyScope("auditor")).toBe("cross");
  });
});

describe("companyScope — 自社限定ロール", () => {
  it("operations_staff は own", () => {
    expect(companyScope("operations_staff")).toBe("own");
  });
  it("sales は own", () => {
    expect(companyScope("sales")).toBe("own");
  });
  it("accounting は own", () => {
    expect(companyScope("accounting")).toBe("own");
  });
});

describe("companyScope — 別軸制御ロール", () => {
  it("client_portal_user は other", () => {
    expect(companyScope("client_portal_user")).toBe("other");
  });
  it("external_specialist は other", () => {
    expect(companyScope("external_specialist")).toBe("other");
  });
});

describe("getUserAccessMode", () => {
  it("admin は cross_company", () => {
    expect(getUserAccessMode("admin")).toBe("cross_company");
  });

  it("operations_staff は company_scoped", () => {
    expect(getUserAccessMode("operations_staff")).toBe("company_scoped");
  });

  it("external_specialist は specialist モード", () => {
    expect(getUserAccessMode("external_specialist")).toBe("external_specialist");
  });
});

// ---------------------------------------------------------------
// validateOperatingCompanyAssignment
// ---------------------------------------------------------------

describe("validateOperatingCompanyAssignment", () => {
  it("cross ロールは運営会社を NULL に正規化する", () => {
    const result = validateOperatingCompanyAssignment("admin", GRAST_ID);
    expect(result.ok).toBe(true);
    expect(result.normalizedOperatingCompanyId).toBeNull();
  });

  it("own ロールは運営会社未設定だとエラーになる", () => {
    const result = validateOperatingCompanyAssignment("operations_staff", null);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("own ロールは運営会社指定があれば通る", () => {
    const result = validateOperatingCompanyAssignment("sales", AIM_ID);
    expect(result.ok).toBe(true);
    expect(result.normalizedOperatingCompanyId).toBe(AIM_ID);
  });

  it("other ロールは運営会社未設定でも通る", () => {
    const result = validateOperatingCompanyAssignment("external_specialist", null);
    expect(result.ok).toBe(true);
    expect(result.normalizedOperatingCompanyId).toBeNull();
  });

  it("社労士ロールは運営会社指定があっても NULL に正規化する", () => {
    const result = validateOperatingCompanyAssignment("external_specialist", GRAST_ID);
    expect(result.ok).toBe(true);
    expect(result.normalizedOperatingCompanyId).toBeNull();
  });
});

// ---------------------------------------------------------------
// ロールセットの整合性
// ---------------------------------------------------------------

describe("CROSS_COMPANY_ROLES / OWN_COMPANY_ROLES の整合性", () => {
  it("CROSS と OWN は重複しない", () => {
    const intersection = [...CROSS_COMPANY_ROLES].filter((r) =>
      OWN_COMPANY_ROLES.has(r)
    );
    expect(intersection).toHaveLength(0);
  });

  it("CROSS_COMPANY_ROLES は admin / operations_manager / auditor を含む", () => {
    expect(CROSS_COMPANY_ROLES.has("admin")).toBe(true);
    expect(CROSS_COMPANY_ROLES.has("operations_manager")).toBe(true);
    expect(CROSS_COMPANY_ROLES.has("auditor")).toBe(true);
  });

  it("OWN_COMPANY_ROLES は operations_staff / sales / accounting を含む", () => {
    expect(OWN_COMPANY_ROLES.has("operations_staff")).toBe(true);
    expect(OWN_COMPANY_ROLES.has("sales")).toBe(true);
    expect(OWN_COMPANY_ROLES.has("accounting")).toBe(true);
  });

  it("access mode ごとのロール一覧が期待どおり", () => {
    expect(getRoleCodesForAccessMode("cross_company")).toEqual([
      "admin",
      "operations_manager",
      "auditor",
    ]);
    expect(getRoleCodesForAccessMode("company_scoped")).toEqual([
      "operations_staff",
      "sales",
      "accounting",
    ]);
  });
});
