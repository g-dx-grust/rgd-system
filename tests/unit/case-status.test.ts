import { describe, it, expect } from "vitest";
import {
  CASE_STATUS,
  CASE_STATUS_LABELS,
  CASE_STATUS_VARIANT,
  CASE_STATUS_ORDER,
  CASE_STATUS_OPTIONS,
  type CaseStatus,
} from "@/lib/constants/case-status";

const ALL_STATUSES = Object.values(CASE_STATUS) as CaseStatus[];

describe("CASE_STATUS と CASE_STATUS_LABELS の整合性", () => {
  it("CLAUDE.md 定義の 15 ステータスがすべて存在する", () => {
    const expected: string[] = [
      "case_received",
      "initial_guide_pending",
      "doc_collecting",
      "pre_application_ready",
      "pre_application_shared",
      "labor_office_waiting",
      "post_acceptance_processing",
      "training_in_progress",
      "completion_preparing",
      "final_reviewing",
      "final_application_shared",
      "completed",
      "on_hold",
      "returned",
      "cancelled",
    ];
    expect(ALL_STATUSES).toHaveLength(expected.length);
    for (const s of expected) {
      expect(ALL_STATUSES).toContain(s);
    }
  });

  it("CASE_STATUS の各値に対応するラベルが存在する", () => {
    for (const status of ALL_STATUSES) {
      expect(CASE_STATUS_LABELS).toHaveProperty(status);
      expect(CASE_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it("CASE_STATUS_LABELS に余分なキーが存在しない", () => {
    const statusSet = new Set(ALL_STATUSES);
    for (const key of Object.keys(CASE_STATUS_LABELS)) {
      expect(statusSet.has(key as CaseStatus)).toBe(true);
    }
  });

  it("CASE_STATUS の各値に対応する variant が存在する", () => {
    for (const status of ALL_STATUSES) {
      expect(CASE_STATUS_VARIANT).toHaveProperty(status);
    }
  });

  it("CASE_STATUS_VARIANT の値はすべて有効な variant 種別", () => {
    const validVariants = ["default", "accent", "success", "warning", "error"];
    for (const variant of Object.values(CASE_STATUS_VARIANT)) {
      expect(validVariants).toContain(variant);
    }
  });
});

describe("CASE_STATUS_ORDER の整合性", () => {
  it("CASE_STATUS_ORDER に含まれるステータスはすべて有効", () => {
    const statusSet = new Set(ALL_STATUSES);
    for (const status of CASE_STATUS_ORDER) {
      expect(statusSet.has(status)).toBe(true);
    }
  });

  it("CASE_STATUS_ORDER に重複が存在しない", () => {
    const unique = new Set(CASE_STATUS_ORDER);
    expect(unique.size).toBe(CASE_STATUS_ORDER.length);
  });

  it("エラー系ステータス (on_hold / returned / cancelled) は通常フロー順に含まれない", () => {
    expect(CASE_STATUS_ORDER).not.toContain(CASE_STATUS.ON_HOLD);
    expect(CASE_STATUS_ORDER).not.toContain(CASE_STATUS.RETURNED);
    expect(CASE_STATUS_ORDER).not.toContain(CASE_STATUS.CANCELLED);
  });

  it("completed が通常フロー順の末尾", () => {
    const last = CASE_STATUS_ORDER[CASE_STATUS_ORDER.length - 1];
    expect(last).toBe(CASE_STATUS.COMPLETED);
  });

  it("case_received が通常フロー順の先頭", () => {
    expect(CASE_STATUS_ORDER[0]).toBe(CASE_STATUS.CASE_RECEIVED);
  });
});

describe("CASE_STATUS_OPTIONS の整合性", () => {
  it("CASE_STATUS_OPTIONS の件数が CASE_STATUS_LABELS と一致する", () => {
    expect(CASE_STATUS_OPTIONS).toHaveLength(
      Object.keys(CASE_STATUS_LABELS).length
    );
  });

  it("各オプションは value と label を持つ", () => {
    for (const option of CASE_STATUS_OPTIONS) {
      expect(option).toHaveProperty("value");
      expect(option).toHaveProperty("label");
      expect(option.value).toBeTruthy();
      expect(option.label).toBeTruthy();
    }
  });

  it("オプションの value がすべて有効なステータス", () => {
    const statusSet = new Set(ALL_STATUSES);
    for (const option of CASE_STATUS_OPTIONS) {
      expect(statusSet.has(option.value)).toBe(true);
    }
  });
});

describe("ステータス別 variant の意味整合性", () => {
  it("completed は success variant", () => {
    expect(CASE_STATUS_VARIANT[CASE_STATUS.COMPLETED]).toBe("success");
  });

  it("returned は error variant", () => {
    expect(CASE_STATUS_VARIANT[CASE_STATUS.RETURNED]).toBe("error");
  });

  it("cancelled は error variant", () => {
    expect(CASE_STATUS_VARIANT[CASE_STATUS.CANCELLED]).toBe("error");
  });

  it("on_hold は warning variant", () => {
    expect(CASE_STATUS_VARIANT[CASE_STATUS.ON_HOLD]).toBe("warning");
  });
});
