"use client";

/**
 * DocumentPreview
 *
 * 署名付きURLを取得してファイルをインライン表示する。
 * PDF / 画像 / テキストに対応。それ以外はダウンロードリンクのみ。
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

interface Props {
  documentId:       string;
  originalFilename: string;
  mimeType:         string;
  onClose:          () => void;
}

export function DocumentPreview({ documentId, originalFilename, mimeType, onClose }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch(`/api/documents/${documentId}/signed-url`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const { error: msg } = await res.json() as { error: string };
          throw new Error(msg);
        }
        return res.json() as Promise<{ signedUrl: string }>;
      })
      .then(({ signedUrl }) => {
        if (!cancelled) {
          setSignedUrl(signedUrl);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [documentId]);

  const isPdf   = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");
  const isText  = mimeType === "text/plain" || mimeType === "text/csv";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`プレビュー: ${originalFilename}`}
    >
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ウィンドウ */}
      <div className="relative z-10 flex flex-col bg-white rounded-[var(--radius-md)] shadow-lg w-[90vw] max-w-4xl max-h-[90vh]">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <span className="text-sm font-medium text-[var(--color-text)] truncate max-w-[60%]">
            {originalFilename}
          </span>
          <div className="flex items-center gap-2">
            {signedUrl && (
              <a
                href={signedUrl}
                download={originalFilename}
                className="text-sm text-[var(--color-accent)] hover:underline"
              >
                ダウンロード
              </a>
            )}
            <Button variant="secondary" size="sm" onClick={onClose}>
              閉じる
            </Button>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-auto p-2">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <span
                className="inline-block w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-64">
              <p className="text-sm text-[#DC2626]">{error}</p>
            </div>
          )}
          {signedUrl && !loading && (
            <>
              {isPdf && (
                <iframe
                  src={signedUrl}
                  title={originalFilename}
                  className="w-full h-[75vh] border-0"
                />
              )}
              {isImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signedUrl}
                  alt={originalFilename}
                  className="max-w-full max-h-[75vh] mx-auto object-contain"
                />
              )}
              {isText && (
                <TextPreview url={signedUrl} />
              )}
              {!isPdf && !isImage && !isText && (
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    このファイル形式はプレビューに対応していません
                  </p>
                  <a
                    href={signedUrl}
                    download={originalFilename}
                    className="text-sm text-[var(--color-accent)] hover:underline font-medium"
                  >
                    ダウンロードして確認する
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    fetch(url)
      .then((r) => r.text())
      .then(setText)
      .catch(() => setText("テキストの読み込みに失敗しました"));
  }, [url]);

  if (!text) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="text-sm text-[var(--color-text-muted)]">読込中…</span>
      </div>
    );
  }

  return (
    <pre className="text-xs text-[var(--color-text)] whitespace-pre-wrap break-all p-2 font-mono leading-relaxed">
      {text}
    </pre>
  );
}
