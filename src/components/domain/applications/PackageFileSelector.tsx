"use client";

/**
 * 共有対象ファイル選定 UI
 *
 * 案件に紐づく承認済み書類から、申請パッケージに含めるファイルを選択するクライアントコンポーネント。
 */

import { useState } from "react";
import type { CreateApplicationPackageItemInput } from "@/types/application-packages";

export interface SelectableDocument {
  documentId:      string;
  originalFilename: string;
  documentTypeName: string;
  participantName?: string | null;
  versionNo:       number;
  reviewStatus:    string;
}

interface Props {
  documents:    SelectableDocument[];
  onSelectionChange: (items: CreateApplicationPackageItemInput[]) => void;
}

export function PackageFileSelector({ documents, onSelectionChange }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(documentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(documentId)) {
        next.delete(documentId);
      } else {
        next.add(documentId);
      }

      const items: CreateApplicationPackageItemInput[] = Array.from(next).map((id, idx) => {
        const doc = documents.find((d) => d.documentId === id)!;
        return {
          documentId:        id,
          snapshotVersionNo: doc.versionNo,
          itemType:          "file",
          label:             doc.originalFilename,
          sortOrder:         idx,
        };
      });

      onSelectionChange(items);
      return next;
    });
  }

  function selectAll() {
    const allIds = new Set(documents.map((d) => d.documentId));
    setSelected(allIds);
    const items: CreateApplicationPackageItemInput[] = documents.map((doc, idx) => ({
      documentId:        doc.documentId,
      snapshotVersionNo: doc.versionNo,
      itemType:          "file",
      label:             doc.originalFilename,
      sortOrder:         idx,
    }));
    onSelectionChange(items);
  }

  function clearAll() {
    setSelected(new Set());
    onSelectionChange([]);
  }

  if (documents.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
        承認済みのファイルがありません。
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[var(--color-text-muted)]">
          {selected.size} / {documents.length} 件を選択中
        </span>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            すべて選択
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            解除
          </button>
        </div>
      </div>

      <div className="border border-[var(--color-border)] rounded-[var(--radius-md)] divide-y divide-[var(--color-border)]">
        {documents.map((doc) => {
          const isChecked = selected.has(doc.documentId);
          return (
            <label
              key={doc.documentId}
              className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[var(--color-bg-secondary)]"
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(doc.documentId)}
                className="w-4 h-4 accent-[var(--color-accent)]"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--color-text)] truncate">
                  {doc.originalFilename}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {doc.participantName
                    ? `${doc.participantName} / ${doc.documentTypeName}`
                    : doc.documentTypeName}
                  {" · "}v{doc.versionNo}
                </p>
              </div>
              <span
                className={[
                  "text-xs px-1.5 py-0.5 rounded-[var(--radius-sm)]",
                  doc.reviewStatus === "approved"
                    ? "bg-[rgba(22,163,74,0.1)] text-[#16A34A]"
                    : "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]",
                ].join(" ")}
              >
                {doc.reviewStatus === "approved" ? "承認済" : doc.reviewStatus}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
