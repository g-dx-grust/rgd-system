"use client";

/**
 * ExternalUploadClient
 *
 * 顧客向けアップロード画面のインタラクティブ部分。
 * 認証なし・uploadToken 経由でファイルを提出する。
 * 内部メモ・レビュー詳細は表示しない。
 */

import { useState, useCallback } from "react";
import type { ExternalRequirement } from "./page";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/types/documents";

interface Props {
  caseId:         string;
  organizationId: string;
  uploadToken:    string;
  requirements:   ExternalRequirement[];
}

type UploadState =
  | { type: "idle" }
  | { type: "uploading"; progress: string }
  | { type: "done" }
  | { type: "error"; message: string };

const ALLOWED_EXTENSIONS = [
  ".pdf", ".jpg", ".jpeg", ".png", ".webp",
  ".txt", ".csv", ".xlsx", ".zip",
].join(",");

const ALLOWED_MIME_SET = new Set<string>(ALLOWED_MIME_TYPES);

export function ExternalUploadClient({ caseId, organizationId, uploadToken, requirements }: Props) {
  const [states, setStates] = useState<Record<string, UploadState>>(
    Object.fromEntries(requirements.map((r) => [r.id, { type: "idle" }]))
  );

  const setReqState = (reqId: string, state: UploadState) => {
    setStates((prev) => ({ ...prev, [reqId]: state }));
  };

  const handleUpload = useCallback(
    async (requirement: ExternalRequirement, file: File) => {
      if (!ALLOWED_MIME_SET.has(file.type)) {
        setReqState(requirement.id, { type: "error", message: "許可されていないファイル形式です" });
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setReqState(requirement.id, { type: "error", message: "ファイルサイズが100MBを超えています" });
        return;
      }

      setReqState(requirement.id, { type: "uploading", progress: "アップロードURLを取得中…" });

      try {
        // Step 1: 署名付きURL取得（uploadToken でトークン認証）
        const urlRes = await fetch("/api/documents/upload-url", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            caseId,
            organizationId,
            documentTypeId:        requirement.document_type_id,
            documentRequirementId: requirement.id,
            originalFilename:      file.name,
            mimeType:              file.type,
            fileSize:              file.size,
            uploadToken,
          }),
        });

        if (!urlRes.ok) {
          const { error } = await urlRes.json() as { error: string };
          throw new Error(error);
        }

        const { uploadUrl, storagePath } = await urlRes.json() as {
          uploadUrl:   string;
          storagePath: string;
        };

        // Step 2: Storage 直接アップロード
        setReqState(requirement.id, { type: "uploading", progress: "ファイルをアップロード中…" });
        const putRes = await fetch(uploadUrl, {
          method:  "PUT",
          headers: { "Content-Type": file.type },
          body:    file,
        });

        if (!putRes.ok) throw new Error("ファイルのアップロードに失敗しました");

        // Step 3: 登録確認（uploadToken 付き）
        setReqState(requirement.id, { type: "uploading", progress: "書類情報を登録中…" });
        const confirmRes = await fetch("/api/documents/confirm", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            storagePath,
            originalFilename:      file.name,
            mimeType:              file.type,
            fileSize:              file.size,
            caseId,
            organizationId,
            documentTypeId:        requirement.document_type_id,
            documentRequirementId: requirement.id,
            uploadToken,
          }),
        });

        if (!confirmRes.ok) {
          const { error } = await confirmRes.json() as { error: string };
          throw new Error(error);
        }

        setReqState(requirement.id, { type: "done" });
      } catch (err) {
        setReqState(requirement.id, {
          type:    "error",
          message: err instanceof Error ? err.message : "エラーが発生しました",
        });
      }
    },
    [caseId, organizationId, uploadToken]
  );

  return (
    <div className="space-y-3">
      {requirements.map((req) => {
        const state = states[req.id] ?? { type: "idle" };
        const isOverdue = req.due_date && new Date(req.due_date) < new Date();

        return (
          <div
            key={req.id}
            className="bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] px-5 py-4"
          >
            {/* 書類名 */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-[var(--color-text)]">
                {req.documentType.name}
              </span>
              {req.required_flag && (
                <span className="text-xs text-[#DC2626] font-medium">必須</span>
              )}
              {req.status === "returned" && (
                <span className="text-xs font-medium text-[#DC2626] bg-[rgba(220,38,38,0.08)] px-2 py-0.5 rounded-[var(--radius-sm)]">
                  再提出が必要です
                </span>
              )}
            </div>

            {/* 説明 */}
            {req.documentType.description && (
              <p className="text-xs text-[var(--color-text-muted)] mb-2">
                {req.documentType.description}
              </p>
            )}

            {/* 期限 */}
            {req.due_date && (
              <p className={`text-xs mb-3 ${isOverdue ? "text-[#DC2626] font-medium" : "text-[var(--color-text-muted)]"}`}>
                提出期限: {new Date(req.due_date).toLocaleDateString("ja-JP")}
                {isOverdue && " (期限超過)"}
              </p>
            )}

            {/* アップロード状態 */}
            {state.type === "done" ? (
              <div className="flex items-center gap-2 text-sm text-[#16A34A]">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8L6.5 11.5L13 5" stroke="#16A34A" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                提出が完了しました
              </div>
            ) : state.type === "uploading" ? (
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                <span
                  className="inline-block w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
                {state.progress}
              </div>
            ) : (
              <div>
                {state.type === "error" && (
                  <p className="text-xs text-[#DC2626] mb-2">{state.message}</p>
                )}
                <label className="block">
                  <span className="sr-only">ファイルを選択</span>
                  <div
                    className={[
                      "border-2 border-dashed rounded-[var(--radius-sm)] px-4 py-5 text-center cursor-pointer transition-colors",
                      "border-[var(--color-border)] hover:border-[var(--color-accent)]",
                    ].join(" ")}
                  >
                    <p className="text-sm text-[var(--color-text)]">
                      クリックしてファイルを選択
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      PDF / 画像 / テキスト（最大100MB）
                    </p>
                    <input
                      type="file"
                      accept={ALLOWED_EXTENSIONS}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(req, file);
                        e.target.value = "";
                      }}
                    />
                  </div>
                </label>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
