/**
 * 申請パッケージ ZIP ダウンロード
 *
 * GET /api/cases/[id]/packages/[packageId]/download
 *
 * パッケージに含まれるファイルを ZIP にまとめてダウンロードレスポンスとして返す。
 * ファイルは Supabase Storage から直接取得し、メモリ上で ZIP を生成する。
 *
 * 制限: パッケージ内ファイルの合計サイズが大きい場合はメモリを圧迫する可能性がある。
 * 現時点では助成金申請書類（一般的に数MB程度）を想定しており許容範囲内とする。
 */

import { NextResponse } from "next/server";
import JSZip from "jszip";
import { getAuthUser, getCurrentUserProfile } from "@/lib/auth/session";
import { can, PERMISSIONS } from "@/lib/rbac";
import { getApplicationPackage } from "@/server/repositories/application-packages";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; packageId: string }> }
) {
  const { id: caseId, packageId } = await params;

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const profile = await getCurrentUserProfile();
  if (!can(profile?.roleCode, PERMISSIONS.CASE_EDIT)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const pkg = await getApplicationPackage(packageId);
  if (!pkg || pkg.caseId !== caseId) {
    return NextResponse.json({ error: "パッケージが見つかりません" }, { status: 404 });
  }

  const supabaseAdmin = createAdminClient();
  const fileItems = pkg.items.filter((item) => item.itemType === "file" || item.itemType === "pdf");

  if (fileItems.length === 0) {
    return NextResponse.json({ error: "ダウンロード対象のファイルがありません" }, { status: 404 });
  }

  const zip = new JSZip();
  const skipped: string[] = [];

  for (const item of fileItems) {
    if (!item.documentId) {
      skipped.push(item.label ?? item.id);
      continue;
    }

    // ドキュメントのストレージパスを取得
    const { data: doc, error: docError } = await supabaseAdmin
      .from("documents")
      .select("storage_bucket, storage_path, original_filename")
      .eq("id", item.documentId)
      .single();

    if (docError || !doc) {
      skipped.push(item.label ?? item.id);
      continue;
    }

    // Storage からファイルバイナリを取得
    const { data: fileData, error: fileError } = await supabaseAdmin.storage
      .from(String(doc["storage_bucket"]))
      .download(String(doc["storage_path"]));

    if (fileError || !fileData) {
      skipped.push(String(doc["original_filename"]));
      continue;
    }

    // ZIP 内のファイル名: label または original_filename（重複を避けるため itemId をプレフィックス）
    const filename = sanitizeFilename(
      item.label ?? String(doc["original_filename"]) ?? item.id
    );
    const bytes = await fileData.arrayBuffer();
    zip.file(filename, bytes);
  }

  const zipUint8 = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });

  const zipFilename = `package_${packageId.slice(0, 8)}.zip`;

  // NextResponse を使って ArrayBuffer としてレスポンスを返す
  return new NextResponse(zipUint8.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(zipFilename)}`,
      "Content-Length": String(zipUint8.length),
      "Cache-Control": "no-store",
    },
  });
}

/** ZIP 内ファイル名として不正な文字を除去する */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 200);
}
