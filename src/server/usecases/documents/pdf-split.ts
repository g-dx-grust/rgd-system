"use server";

/**
 * PDF分割 Server Actions
 *
 * 1つのPDF書類（例: 雇用契約書＋雇用保険適用届が1ファイルにまとまったもの）を
 * 指定ページで2分割し、それぞれを別々の書類として保存する。
 *
 * - サーバー側で pdf-lib を用いて分割（ストレージから直接読み込み・書き込み）。
 * - 分割した各パートは新しい書類要件を作成して登録するため、一覧に独立して並ぶ。
 * - 元ファイルは任意で論理削除できる。
 */

import { revalidatePath } from "next/cache";
import { PDFDocument } from "pdf-lib";
import { getAuthUser } from "@/lib/auth/session";
import {
  getDocumentById,
  downloadDocumentBytes,
  uploadDocumentBytes,
  registerDocument,
  createRequirement,
  softDeleteDocument,
} from "@/server/repositories/documents";
import { writeAuditLog } from "@/server/repositories/audit-log";

// ------------------------------------------------------------
// PDFページ数取得
// ------------------------------------------------------------

export async function getPdfPageCountAction(
  documentId: string
): Promise<{ pageCount?: number; error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  try {
    const doc = await getDocumentById(documentId);
    if (!doc) return { error: "書類が見つかりません" };
    if (doc.mimeType !== "application/pdf") {
      return { error: "PDFファイルのみ分割できます" };
    }

    const bytes = await downloadDocumentBytes(doc.storagePath);
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    return { pageCount: pdf.getPageCount() };
  } catch (err) {
    console.error("[getPdfPageCount] error:", err);
    return { error: "PDFの読み込みに失敗しました" };
  }
}

// ------------------------------------------------------------
// PDF分割
// ------------------------------------------------------------

/** ストレージパスを生成する（/api/documents/upload-url と同じ規則） */
function buildStoragePath(
  caseId: string,
  participantId: string | null,
  documentTypeId: string,
  filename: string
): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const uuid = crypto.randomUUID();
  const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  return participantId
    ? `cases/${caseId}/participants/${participantId}/${documentTypeId}/${yyyy}/${mm}/${uuid}_${safeName}`
    : `cases/${caseId}/company/${documentTypeId}/${yyyy}/${mm}/${uuid}_${safeName}`;
}

/** ページ範囲を抽出した新しいPDFのバイト列を作る（startPage/endPage は1始まり・両端含む） */
async function extractPages(
  source: PDFDocument,
  startPage: number,
  endPage: number
): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const indices: number[] = [];
  for (let i = startPage - 1; i <= endPage - 1; i++) indices.push(i);
  const copied = await out.copyPages(source, indices);
  copied.forEach((p) => out.addPage(p));
  return out.save();
}

export async function splitPdfDocumentAction(params: {
  documentId:     string;
  caseId:         string;
  /** このページの後で分割する（例: 3 なら 1-3 と 4-末尾 に分かれる） */
  splitAfterPage: number;
  firstTypeId:    string;
  secondTypeId:   string;
  firstName?:     string;
  secondName?:    string;
  deleteOriginal: boolean;
}): Promise<{ success?: boolean; error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "認証が必要です" };

  try {
    const source = await getDocumentById(params.documentId);
    if (!source) return { error: "元の書類が見つかりません" };
    if (source.mimeType !== "application/pdf") {
      return { error: "PDFファイルのみ分割できます" };
    }

    const bytes = await downloadDocumentBytes(source.storagePath);
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const total = pdf.getPageCount();

    if (params.splitAfterPage < 1 || params.splitAfterPage >= total) {
      return { error: `分割位置は 1〜${total - 1} の範囲で指定してください` };
    }

    const baseName = source.originalFilename.replace(/\.pdf$/i, "");
    const parts = [
      {
        typeId: params.firstTypeId,
        name:   `${params.firstName?.trim() || `${baseName}_1`}.pdf`,
        start:  1,
        end:    params.splitAfterPage,
      },
      {
        typeId: params.secondTypeId,
        name:   `${params.secondName?.trim() || `${baseName}_2`}.pdf`,
        start:  params.splitAfterPage + 1,
        end:    total,
      },
    ];

    for (const part of parts) {
      const partBytes = await extractPages(pdf, part.start, part.end);

      // パートごとに要件を作成
      const requirement = await createRequirement({
        caseId:         params.caseId,
        participantId:  source.participantId ?? undefined,
        documentTypeId: part.typeId,
        requiredFlag:   false,
        note:           `「${source.originalFilename}」から分割（${part.start}-${part.end}ページ）`,
      });

      const storagePath = buildStoragePath(
        params.caseId,
        source.participantId,
        part.typeId,
        part.name
      );
      await uploadDocumentBytes(storagePath, partBytes, "application/pdf");

      await registerDocument(
        {
          storagePath,
          originalFilename:      part.name,
          mimeType:              "application/pdf",
          fileSize:              partBytes.byteLength,
          caseId:                params.caseId,
          organizationId:        source.organizationId,
          participantId:         source.participantId ?? undefined,
          documentTypeId:        part.typeId,
          documentRequirementId: requirement.id,
        },
        user.id
      );
    }

    if (params.deleteOriginal) {
      await softDeleteDocument(source.id);
    }

    await writeAuditLog({
      userId:     user.id,
      action:     "document_upload",
      targetType: "document",
      targetId:   source.id,
      metadata:   {
        action:         "pdf_split",
        caseId:         params.caseId,
        splitAfterPage: params.splitAfterPage,
        deleteOriginal: params.deleteOriginal,
      },
    });

    revalidatePath(`/cases/${params.caseId}/documents`);
    revalidatePath(`/cases/${params.caseId}`);
    return { success: true };
  } catch (err) {
    console.error("[splitPdfDocument] error:", err);
    return { error: "PDFの分割に失敗しました" };
  }
}
