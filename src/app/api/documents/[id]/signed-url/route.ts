/**
 * GET /api/documents/[id]/signed-url
 *
 * 書類の署名付き閲覧URLを発行する（300秒有効）。
 * ロールに応じた案件単位の権限チェックを行った後、Storage から一時URLを生成して返す。
 *
 * 権限ルール:
 *   - client_portal_user : 自組織の案件書類のみ閲覧可
 *   - external_specialist: 現時点では拒否（Step5以降で共有パッケージ経由に限定実装予定）
 *   - 内部ユーザー        : 全案件許可（将来的に担当案件制限を検討）
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/session";
import {
  getDocumentById,
  createViewSignedUrl,
} from "@/server/repositories/documents";
import { writeAuditLog } from "@/server/repositories/audit-log";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (!profile.isActive) {
    return NextResponse.json({ error: "アカウントが無効です" }, { status: 403 });
  }

  const { id } = await params;

  const document = await getDocumentById(id).catch(() => null);
  if (!document) {
    return NextResponse.json({ error: "書類が見つかりません" }, { status: 404 });
  }

  // --- 案件単位の権限チェック ---
  if (profile.roleCode === "external_specialist") {
    return NextResponse.json(
      { error: "アクセス権限がありません" },
      { status: 403 }
    );
  }
  if (profile.roleCode === "client_portal_user") {
    if (document.organizationId !== profile.organizationId) {
      return NextResponse.json(
        { error: "アクセス権限がありません" },
        { status: 403 }
      );
    }
  }

  try {
    const signedUrl = await createViewSignedUrl(document.storagePath, 300);
    const expiresAt = new Date(Date.now() + 300 * 1000).toISOString();

    // 監査ログ（非同期・失敗しても主処理はブロックしない）
    void writeAuditLog({
      userId:     profile.id,
      action:     "document_view",
      targetType: "document",
      targetId:   document.id,
      metadata:   { caseId: document.caseId, organizationId: document.organizationId },
    });

    return NextResponse.json({ signedUrl, expiresAt });
  } catch (err) {
    console.error("[signed-url] error:", err);
    return NextResponse.json(
      { error: "閲覧URLの発行に失敗しました" },
      { status: 500 }
    );
  }
}
