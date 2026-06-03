"use client";

/**
 * SplitPdfModal
 *
 * 1つのPDF書類を指定ページで2分割し、それぞれ別書類として保存するモーダル。
 * 例: 雇用契約書＋雇用保険適用届が1ファイルになっている場合に分割する。
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  getPdfPageCountAction,
  splitPdfDocumentAction,
} from "@/server/usecases/documents/pdf-split";
import type { DocumentType } from "@/types/documents";

interface Props {
  documentId:       string;
  caseId:           string;
  originalFilename: string;
  currentTypeId:    string;
  documentTypes:    DocumentType[];
  onClose:          () => void;
  onSuccess:        () => void;
}

export function SplitPdfModal({
  documentId,
  caseId,
  originalFilename,
  currentTypeId,
  documentTypes,
  onClose,
  onSuccess,
}: Props) {
  const [pageCount, setPageCount]     = useState<number | null>(null);
  const [loading, setLoading]         = useState(true);
  const [splitAfter, setSplitAfter]   = useState(1);
  const [firstTypeId, setFirstTypeId] = useState(currentTypeId);
  const [secondTypeId, setSecondTypeId] = useState("");
  const [deleteOriginal, setDeleteOriginal] = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await getPdfPageCountAction(documentId);
      if (!active) return;
      if (res.error || !res.pageCount) {
        setError(res.error ?? "PDFの読み込みに失敗しました");
      } else {
        setPageCount(res.pageCount);
        setSplitAfter(Math.min(1, res.pageCount - 1) || 1);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [documentId]);

  const handleSubmit = async () => {
    if (!firstTypeId || !secondTypeId) {
      setError("分割後の書類種別を2つとも選択してください");
      return;
    }
    if (pageCount && (splitAfter < 1 || splitAfter >= pageCount)) {
      setError(`分割位置は 1〜${pageCount - 1} の範囲で指定してください`);
      return;
    }
    setError(null);
    setSubmitting(true);
    const res = await splitPdfDocumentAction({
      documentId,
      caseId,
      splitAfterPage: splitAfter,
      firstTypeId,
      secondTypeId,
      deleteOriginal,
    });
    setSubmitting(false);
    if (res.error) {
      setError(res.error);
    } else {
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-lg rounded-[var(--radius-md)] bg-white p-6 shadow-lg">
        <h2 className="mb-1 text-base font-semibold text-[var(--color-text)]">
          PDFを分割
        </h2>
        <p className="mb-4 truncate text-xs text-[var(--color-text-muted)]">
          {originalFilename}
        </p>

        {loading ? (
          <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">
            読み込み中…
          </p>
        ) : pageCount === null ? (
          <p className="py-6 text-center text-sm text-[#DC2626]">
            {error ?? "PDFを読み込めませんでした"}
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text)]">
              全 <span className="font-semibold">{pageCount}</span> ページ
            </p>

            {/* 分割位置 */}
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-muted)]">
                分割位置（このページの後ろで分けます）
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={pageCount - 1}
                  value={splitAfter}
                  onChange={(e) => setSplitAfter(Number(e.target.value))}
                  className="w-24 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
                />
                <span className="text-xs text-[var(--color-text-muted)]">
                  → 1〜{splitAfter} ページ ／ {splitAfter + 1}〜{pageCount} ページ に分割
                </span>
              </div>
            </div>

            {/* 種別選択 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[var(--color-text-muted)]">
                  前半（1〜{splitAfter}p）の書類種別
                </label>
                <select
                  value={firstTypeId}
                  onChange={(e) => setFirstTypeId(e.target.value)}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
                >
                  <option value="">-- 選択 --</option>
                  {documentTypes.map((dt) => (
                    <option key={dt.id} value={dt.id}>{dt.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--color-text-muted)]">
                  後半（{splitAfter + 1}〜{pageCount}p）の書類種別
                </label>
                <select
                  value={secondTypeId}
                  onChange={(e) => setSecondTypeId(e.target.value)}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
                >
                  <option value="">-- 選択 --</option>
                  {documentTypes.map((dt) => (
                    <option key={dt.id} value={dt.id}>{dt.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 元ファイル削除 */}
            <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={deleteOriginal}
                onChange={(e) => setDeleteOriginal(e.target.checked)}
              />
              分割後、元のPDFを削除する
            </label>

            {error && <p className="text-xs text-[#DC2626]">{error}</p>}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            キャンセル
          </Button>
          {pageCount !== null && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              loading={submitting}
            >
              分割して保存
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
