/**
 * 申請パッケージ リポジトリ
 *
 * application_packages / application_package_items テーブルへのアクセス。
 * サーバーサイド（Server Action / Route Handler）限定。
 */

import { createClient } from "@/lib/supabase/server";
import type {
  ApplicationPackage,
  ApplicationPackageItem,
  CreateApplicationPackageInput,
  PackageStatus,
} from "@/types/application-packages";

// ------------------------------------------------------------
// 型変換ヘルパー
// ------------------------------------------------------------

function toItem(row: Record<string, unknown>): ApplicationPackageItem {
  const doc = row["documents"] as Record<string, unknown> | null;
  return {
    id:                String(row["id"]),
    packageId:         String(row["package_id"]),
    documentId:        row["document_id"] != null ? String(row["document_id"]) : null,
    snapshotVersionNo: row["snapshot_version_no"] != null ? Number(row["snapshot_version_no"]) : null,
    itemType:          String(row["item_type"]) as ApplicationPackageItem["itemType"],
    label:             row["label"] != null ? String(row["label"]) : null,
    note:              row["note"] != null ? String(row["note"]) : null,
    sortOrder:         Number(row["sort_order"] ?? 0),
    originalFilename:  doc?.["original_filename"] != null ? String(doc["original_filename"]) : null,
    mimeType:          doc?.["mime_type"] != null ? String(doc["mime_type"]) : null,
  };
}

type SupabaseClient = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

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

function toPackage(
  row: Record<string, unknown>,
  items: ApplicationPackageItem[] = [],
  nameMap?: Map<string, string>
): ApplicationPackage {
  const generatedBy = row["generated_by"] != null ? String(row["generated_by"]) : null;
  return {
    id:                     String(row["id"]),
    caseId:                 String(row["case_id"]),
    packageType:            String(row["package_type"]) as ApplicationPackage["packageType"],
    packageStatus:          String(row["package_status"]) as PackageStatus,
    generatedBy,
    generatedByName:        generatedBy && nameMap ? (nameMap.get(generatedBy) ?? null) : null,
    generatedAt:            String(row["generated_at"]),
    exportedFileDocumentId: row["exported_file_document_id"] != null
      ? String(row["exported_file_document_id"]) : null,
    sharedTo:               row["shared_to"] != null ? String(row["shared_to"]) : null,
    sharedAt:               row["shared_at"] != null ? String(row["shared_at"]) : null,
    note:                   row["note"] != null ? String(row["note"]) : null,
    items,
  };
}

// ------------------------------------------------------------
// 案件の申請パッケージ一覧
// ------------------------------------------------------------

export async function listApplicationPackages(caseId: string): Promise<ApplicationPackage[]> {
  const supabase = await createClient();

  const { data: pkgs, error: pkgError } = await supabase
    .from("application_packages")
    .select(
      `id, case_id, package_type, package_status, generated_by, generated_at,
       exported_file_document_id, shared_to, shared_at, note`
    )
    .eq("case_id", caseId)
    .order("generated_at", { ascending: false });

  if (pkgError) throw new Error(pkgError.message);
  if (!pkgs || pkgs.length === 0) return [];

  const packageIds = pkgs.map((p) => p.id as string);

  // generated_by の表示名を取得
  const generatorIds = [...new Set(
    pkgs.map((p) => p["generated_by"]).filter((id): id is string => !!id)
  )];
  const nameMap = await fetchUserNameMap(supabase, generatorIds);

  const { data: itemRows, error: itemError } = await supabase
    .from("application_package_items")
    .select(
      `id, package_id, document_id, snapshot_version_no, item_type, label, note, sort_order,
       documents ( original_filename, mime_type )`
    )
    .in("package_id", packageIds)
    .order("sort_order", { ascending: true });

  if (itemError) throw new Error(itemError.message);

  const itemsByPackage = new Map<string, ApplicationPackageItem[]>();
  for (const item of itemRows ?? []) {
    const pid = String(item["package_id"]);
    if (!itemsByPackage.has(pid)) itemsByPackage.set(pid, []);
    itemsByPackage.get(pid)!.push(toItem(item as Record<string, unknown>));
  }

  return pkgs.map((p) =>
    toPackage(p as Record<string, unknown>, itemsByPackage.get(String(p["id"])) ?? [], nameMap)
  );
}

// ------------------------------------------------------------
// 申請パッケージ詳細
// ------------------------------------------------------------

export async function getApplicationPackage(id: string): Promise<ApplicationPackage | null> {
  const supabase = await createClient();

  const { data: pkg, error: pkgError } = await supabase
    .from("application_packages")
    .select(
      `id, case_id, package_type, package_status, generated_by, generated_at,
       exported_file_document_id, shared_to, shared_at, note`
    )
    .eq("id", id)
    .single();

  if (pkgError || !pkg) return null;

  // generated_by の表示名を取得
  const generatorId = pkg["generated_by"] ? [String(pkg["generated_by"])] : [];
  const nameMap = await fetchUserNameMap(supabase, generatorId);

  const { data: itemRows, error: itemError } = await supabase
    .from("application_package_items")
    .select(
      `id, package_id, document_id, snapshot_version_no, item_type, label, note, sort_order,
       documents ( original_filename, mime_type )`
    )
    .eq("package_id", id)
    .order("sort_order", { ascending: true });

  if (itemError) throw new Error(itemError.message);

  const items = (itemRows ?? []).map((r) => toItem(r as Record<string, unknown>));
  return toPackage(pkg as Record<string, unknown>, items, nameMap);
}

// ------------------------------------------------------------
// 申請パッケージ作成（ドラフト）
// ------------------------------------------------------------

export async function createApplicationPackage(
  input: CreateApplicationPackageInput,
  generatedBy: string
): Promise<ApplicationPackage> {
  const supabase = await createClient();

  const { data: pkg, error: pkgError } = await supabase
    .from("application_packages")
    .insert({
      case_id:       input.caseId,
      package_type:  input.packageType,
      package_status: "draft",
      generated_by:  generatedBy,
      shared_to:     input.sharedTo ?? null,
      note:          input.note ?? null,
    })
    .select("id, case_id, package_type, package_status, generated_by, generated_at, exported_file_document_id, shared_to, shared_at, note")
    .single();

  if (pkgError || !pkg) throw new Error(pkgError?.message ?? "パッケージ作成に失敗しました");

  const packageId = String(pkg["id"]);

  if (input.items.length > 0) {
    const itemRows = input.items.map((item, idx) => ({
      package_id:          packageId,
      document_id:         item.documentId ?? null,
      snapshot_version_no: item.snapshotVersionNo ?? null,
      item_type:           item.itemType,
      label:               item.label ?? null,
      note:                item.note ?? null,
      sort_order:          item.sortOrder ?? idx,
    }));

    const { error: itemError } = await supabase
      .from("application_package_items")
      .insert(itemRows);

    if (itemError) throw new Error(itemError.message);
  }

  return (await getApplicationPackage(packageId))!;
}

// ------------------------------------------------------------
// ステータス更新（shared / archived）
// ------------------------------------------------------------

export async function updatePackageStatus(
  packageId: string,
  status: PackageStatus,
  sharedTo?: string
): Promise<void> {
  const supabase = await createClient();

  const updates: Record<string, unknown> = { package_status: status };
  if (status === "shared") {
    updates["shared_at"] = new Date().toISOString();
    if (sharedTo !== undefined) updates["shared_to"] = sharedTo;
  }

  const { error } = await supabase
    .from("application_packages")
    .update(updates)
    .eq("id", packageId);

  if (error) throw new Error(error.message);
}

// ------------------------------------------------------------
// パッケージアイテム追加
// ------------------------------------------------------------

export interface AddPackageItemInput {
  packageId:         string;
  documentId?:       string;
  snapshotVersionNo?: number;
  itemType:          ApplicationPackageItem["itemType"];
  label?:            string;
  note?:             string;
  sortOrder?:        number;
}

export async function addPackageItem(input: AddPackageItemInput): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("application_package_items").insert({
    package_id:          input.packageId,
    document_id:         input.documentId ?? null,
    snapshot_version_no: input.snapshotVersionNo ?? null,
    item_type:           input.itemType,
    label:               input.label ?? null,
    note:                input.note ?? null,
    sort_order:          input.sortOrder ?? 0,
  });

  if (error) throw new Error(error.message);
}

// ------------------------------------------------------------
// パッケージアイテム削除
// ------------------------------------------------------------

export async function removePackageItem(itemId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("application_package_items")
    .delete()
    .eq("id", itemId);
  if (error) throw new Error(error.message);
}
