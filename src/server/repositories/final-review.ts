/**
 * 終了申請準備チェックリスト / 最終社労士連携 リポジトリ
 *
 * final_review_items / final_specialist_linkages テーブルへのアクセス。
 * サーバーサイド（Server Action / Route Handler）限定。
 */

import { createClient } from "@/lib/supabase/server";
import type {
  FinalReviewItem,
  FinalSpecialistLinkage,
  CreateFinalReviewItemInput,
  CreateFinalSpecialistLinkageInput,
} from "@/types/surveys";

// ------------------------------------------------------------
// ユーザー名ヘルパー
// ------------------------------------------------------------

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function fetchUserNameMap(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const { data } = await supabase
    .from("user_profiles")
    .select("id, display_name")
    .in("id", userIds);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row["id"] && row["display_name"]) {
      map.set(String(row["id"]), String(row["display_name"]));
    }
  }
  return map;
}

// ------------------------------------------------------------
// 型変換ヘルパー
// ------------------------------------------------------------

function toReviewItem(row: Record<string, unknown>, nameMap?: Map<string, string>): FinalReviewItem {
  const checkedBy = row["checked_by"] != null ? String(row["checked_by"]) : null;
  return {
    id:            String(row["id"]),
    caseId:        String(row["case_id"]),
    itemType:      String(row["item_type"]) as FinalReviewItem["itemType"],
    label:         String(row["label"]),
    isChecked:     Boolean(row["is_checked"]),
    checkedBy,
    checkedAt:     row["checked_at"] != null ? String(row["checked_at"]) : null,
    note:          row["note"] != null ? String(row["note"]) : null,
    sortOrder:     Number(row["sort_order"] ?? 0),
    createdAt:     String(row["created_at"]),
    checkedByName: checkedBy && nameMap ? (nameMap.get(checkedBy) ?? null) : null,
  };
}

function toLinkage(row: Record<string, unknown>, nameMap?: Map<string, string>): FinalSpecialistLinkage {
  const createdBy = row["created_by"] != null ? String(row["created_by"]) : null;
  return {
    id:            String(row["id"]),
    caseId:        String(row["case_id"]),
    packageId:     row["package_id"] != null ? String(row["package_id"]) : null,
    linkedTo:      row["linked_to"] != null ? String(row["linked_to"]) : null,
    linkedAt:      String(row["linked_at"]),
    note:          row["note"] != null ? String(row["note"]) : null,
    createdBy,
    createdAt:     String(row["created_at"]),
    createdByName: createdBy && nameMap ? (nameMap.get(createdBy) ?? null) : null,
  };
}

// ============================================================
// FinalReviewItem
// ============================================================

export async function listFinalReviewItems(caseId: string): Promise<FinalReviewItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("final_review_items")
    .select(
      `id, case_id, item_type, label, is_checked, checked_by, checked_at,
       note, sort_order, created_at`
    )
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const checkerIds = [...new Set(
    rows.map((r) => r["checked_by"]).filter((id): id is string => !!id)
  )];
  const nameMap = await fetchUserNameMap(supabase, checkerIds);
  return rows.map((r) => toReviewItem(r as Record<string, unknown>, nameMap));
}

export async function createFinalReviewItem(
  input: CreateFinalReviewItemInput,
  userId: string
): Promise<FinalReviewItem> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("final_review_items")
    .insert({
      case_id:    input.caseId,
      item_type:  input.itemType,
      label:      input.label,
      sort_order: input.sortOrder ?? 0,
      note:       input.note ?? null,
      created_by: userId,
    })
    .select(
      `id, case_id, item_type, label, is_checked, checked_by, checked_at,
       note, sort_order, created_at`
    )
    .single();

  if (error) throw new Error(error.message);
  return toReviewItem(data as Record<string, unknown>);
}

export async function toggleFinalReviewItem(
  itemId: string,
  isChecked: boolean,
  userId: string
): Promise<void> {
  const supabase = await createClient();

  const patch: Record<string, unknown> = { is_checked: isChecked };
  if (isChecked) {
    patch["checked_by"] = userId;
    patch["checked_at"] = new Date().toISOString();
  } else {
    patch["checked_by"] = null;
    patch["checked_at"] = null;
  }

  const { error } = await supabase
    .from("final_review_items")
    .update(patch)
    .eq("id", itemId);

  if (error) throw new Error(error.message);
}

export async function deleteFinalReviewItem(itemId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("final_review_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId);

  if (error) throw new Error(error.message);
}

/**
 * 標準チェックリスト項目を案件に一括生成する
 */
export async function initDefaultFinalReviewItems(
  caseId: string,
  userId: string
): Promise<void> {
  const defaults: { itemType: FinalReviewItem["itemType"]; label: string; sortOrder: number }[] = [
    { itemType: "viewing_log",  label: "視聴ログの最終確認",             sortOrder: 1 },
    { itemType: "lms_progress", label: "LMS進捗・受講完了状況の確認",     sortOrder: 2 },
    { itemType: "survey",       label: "アンケート回収状況の確認",         sortOrder: 3 },
    { itemType: "evidence",     label: "証憑（領収書・給与明細等）の確認", sortOrder: 4 },
    { itemType: "document",     label: "必要書類の最終確認",               sortOrder: 5 },
  ];

  const supabase = await createClient();

  const rows = defaults.map((d) => ({
    case_id:    caseId,
    item_type:  d.itemType,
    label:      d.label,
    sort_order: d.sortOrder,
    created_by: userId,
  }));

  const { error } = await supabase.from("final_review_items").insert(rows);
  if (error) throw new Error(error.message);
}

// ============================================================
// FinalSpecialistLinkage
// ============================================================

export async function listFinalSpecialistLinkages(
  caseId: string
): Promise<FinalSpecialistLinkage[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("final_specialist_linkages")
    .select(
      `id, case_id, package_id, linked_to, linked_at, note, created_by, created_at`
    )
    .eq("case_id", caseId)
    .order("linked_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const creatorIds = [...new Set(
    rows.map((r) => r["created_by"]).filter((id): id is string => !!id)
  )];
  const nameMap = await fetchUserNameMap(supabase, creatorIds);
  return rows.map((r) => toLinkage(r as Record<string, unknown>, nameMap));
}

export async function createFinalSpecialistLinkage(
  input: CreateFinalSpecialistLinkageInput,
  userId: string
): Promise<FinalSpecialistLinkage> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("final_specialist_linkages")
    .insert({
      case_id:    input.caseId,
      package_id: input.packageId ?? null,
      linked_to:  input.linkedTo ?? null,
      note:       input.note ?? null,
      created_by: userId,
    })
    .select(
      `id, case_id, package_id, linked_to, linked_at, note, created_by, created_at`
    )
    .single();

  if (error) throw new Error(error.message);
  return toLinkage(data as Record<string, unknown>);
}
