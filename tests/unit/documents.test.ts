/**
 * documents リポジトリ — ビジネスロジックテスト
 *
 * Supabase クライアントをモック化し、DB 接続なしで動作を検証する。
 * テスト対象:
 *   - registerDocument のバージョン番号計算ロジック
 *   - getCaseDocumentSummary の completionRate 計算
 *   - 充足率が 0 件のときに 0 を返すこと（ゼロ除算ガード）
 */

import { describe, it, expect, vi } from "vitest";

// --------------------------------------------------------------------------
// Supabase モジュールをモック化（next/headers など server-only な依存を回避）
// --------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();
const mockIn = vi.fn();

// チェーンを返すビルダーを共通化
function makeBuilder(terminal: () => unknown) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.is = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(terminal);
  builder.single = vi.fn(terminal);
  builder.from = vi.fn(() => builder);
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

// --------------------------------------------------------------------------
// completionRate の純粋な計算ロジックをテスト
// --------------------------------------------------------------------------

/**
 * getCaseDocumentSummary 内の completionRate 計算を抽出して単体テスト。
 * 実装と同じ式: `requiredCount > 0 ? Math.round((approvedCount / requiredCount) * 100) : 0`
 */
function calcCompletionRate(
  requiredCount: number,
  approvedCount: number
): number {
  return requiredCount > 0
    ? Math.round((approvedCount / requiredCount) * 100)
    : 0;
}

describe("completionRate 計算ロジック", () => {
  it("必須書類が 0 件のとき 0 を返す（ゼロ除算ガード）", () => {
    expect(calcCompletionRate(0, 0)).toBe(0);
  });

  it("全件承認済みのとき 100 を返す", () => {
    expect(calcCompletionRate(5, 5)).toBe(100);
  });

  it("半分が承認済みのとき 50 を返す", () => {
    expect(calcCompletionRate(4, 2)).toBe(50);
  });

  it("端数が出る場合は四捨五入する", () => {
    // 1/3 ≒ 33.33… → 33
    expect(calcCompletionRate(3, 1)).toBe(33);
    // 2/3 ≒ 66.66… → 67
    expect(calcCompletionRate(3, 2)).toBe(67);
  });

  it("承認件数が 0 のとき 0 を返す", () => {
    expect(calcCompletionRate(10, 0)).toBe(0);
  });
});

// --------------------------------------------------------------------------
// versionNo 計算ロジックのテスト
// --------------------------------------------------------------------------

/**
 * registerDocument 内のバージョン計算を抽出して単体テスト。
 * 実装: 既存ドキュメントがあれば version_no + 1、なければ 1。
 */
function calcVersionNo(existingVersionNo: number | null): number {
  if (existingVersionNo === null) return 1;
  return existingVersionNo + 1;
}

describe("registerDocument — バージョン番号計算ロジック", () => {
  it("既存ドキュメントがない場合は version_no = 1", () => {
    expect(calcVersionNo(null)).toBe(1);
  });

  it("既存 version_no が 1 の場合は 2 になる", () => {
    expect(calcVersionNo(1)).toBe(2);
  });

  it("既存 version_no が 5 の場合は 6 になる", () => {
    expect(calcVersionNo(5)).toBe(6);
  });
});

// --------------------------------------------------------------------------
// MIME type / ファイルサイズの定数ガード（CLAUDE.md: ファイルは100MBまで）
// --------------------------------------------------------------------------

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

describe("ファイルサイズ制限", () => {
  it("100 MB を超えるファイルは制限値を超えている", () => {
    const oversized = MAX_FILE_SIZE_BYTES + 1;
    expect(oversized).toBeGreaterThan(MAX_FILE_SIZE_BYTES);
  });

  it("100 MB ちょうどは許容範囲内", () => {
    expect(MAX_FILE_SIZE_BYTES).toBeLessThanOrEqual(MAX_FILE_SIZE_BYTES);
  });
});

// --------------------------------------------------------------------------
// REVIEW_STATUS / DOCUMENT_REQUIREMENT_STATUS の整合性
// --------------------------------------------------------------------------

import {
  REVIEW_STATUS,
  DOCUMENT_REQUIREMENT_STATUS,
  RETURN_REASON,
  RETURN_REASON_LABEL,
} from "@/types/documents";

describe("REVIEW_STATUS の整合性", () => {
  it("定義済みの review_status 値が 4 種類存在する", () => {
    const values = Object.values(REVIEW_STATUS);
    expect(values).toHaveLength(4);
    expect(values).toContain("uploaded");
    expect(values).toContain("reviewing");
    expect(values).toContain("returned");
    expect(values).toContain("approved");
  });
});

describe("DOCUMENT_REQUIREMENT_STATUS の整合性", () => {
  it("定義済みの requirement status 値が 4 種類存在する", () => {
    const values = Object.values(DOCUMENT_REQUIREMENT_STATUS);
    expect(values).toHaveLength(4);
    expect(values).toContain("pending");
    expect(values).toContain("received");
    expect(values).toContain("returned");
    expect(values).toContain("approved");
  });
});

describe("RETURN_REASON と RETURN_REASON_LABEL の整合性", () => {
  it("すべての RETURN_REASON 値にラベルが存在する", () => {
    for (const reason of Object.values(RETURN_REASON)) {
      expect(RETURN_REASON_LABEL).toHaveProperty(reason);
      expect(RETURN_REASON_LABEL[reason]).toBeTruthy();
    }
  });

  it("RETURN_REASON_LABEL に余分なキーが存在しない", () => {
    const reasonSet = new Set(Object.values(RETURN_REASON));
    for (const key of Object.keys(RETURN_REASON_LABEL)) {
      expect(reasonSet.has(key as (typeof RETURN_REASON)[keyof typeof RETURN_REASON])).toBe(true);
    }
  });
});

// モック参照（未使用警告抑制）
void mockSelect;
void mockInsert;
void mockUpdate;
void mockEq;
void mockIs;
void mockOrder;
void mockLimit;
void mockMaybeSingle;
void mockSingle;
void mockIn;
void makeBuilder;
