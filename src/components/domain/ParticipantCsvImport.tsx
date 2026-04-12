"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { bulkCreateParticipantsAction } from "@/server/usecases/participants/actions";
import type { CsvParticipantRow } from "@/server/usecases/participants/actions";

interface Props {
  caseId: string;
  onSuccess?: (count: number) => void;
}

const CSV_TEMPLATE_HEADERS =
  "氏名,氏名（カナ）,社員番号,メールアドレス,部署,雇用形態,入社日(YYYY-MM-DD)";

/** CSVの各行を CsvParticipantRow に変換する */
function parseCsvLine(headers: string[], values: string[]): CsvParticipantRow | null {
  const get = (idx: number) => (values[idx] ?? "").trim();
  const name = get(0);
  if (!name) return null;

  return {
    name,
    nameKana:       get(1) || undefined,
    employeeCode:   get(2) || undefined,
    email:          get(3) || undefined,
    department:     get(4) || undefined,
    employmentType: get(5) || undefined,
    joinedAt:       get(6) || undefined,
  };
}

/**
 * 受講者CSVインポートコンポーネント
 *
 * ファイル選択 → プレビュー → 登録 の3ステップで動作する。
 */
export function ParticipantCsvImport({ caseId, onSuccess }: Props) {
  const fileRef   = useRef<HTMLInputElement>(null);
  const [rows, setRows]       = useState<CsvParticipantRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult]   = useState<{ error?: string; success?: boolean; insertedCount?: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        setParseError("データが空です。ヘッダー行と1行以上のデータが必要です。");
        return;
      }

      const headerLine = lines[0];
      const headers = headerLine.split(",").map((h) => h.trim());
      const parsed: CsvParticipantRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",");
        const row = parseCsvLine(headers, values);
        if (row) parsed.push(row);
      }

      if (parsed.length === 0) {
        setParseError("有効なデータ行がありませんでした。");
        return;
      }

      setRows(parsed);
    };
    reader.readAsText(file, "UTF-8");
  }

  function handleImport() {
    startTransition(async () => {
      const res = await bulkCreateParticipantsAction(caseId, rows);
      setResult(res);
      if (res.success && res.insertedCount) {
        setRows([]);
        if (fileRef.current) fileRef.current.value = "";
        onSuccess?.(res.insertedCount);
      }
    });
  }

  function downloadTemplate() {
    const blob = new Blob(["\uFEFF" + CSV_TEMPLATE_HEADERS + "\n"], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a   = document.createElement("a");
    a.href     = url;
    a.download = "participants_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* テンプレートDL */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={downloadTemplate}
          className="text-sm text-[var(--color-accent)] underline underline-offset-2 hover:text-[var(--color-accent-hover)]"
        >
          CSVテンプレートをダウンロード
        </button>
        <span className="text-xs text-[var(--color-text-muted)]">
          UTF-8形式のCSVファイルに対応しています
        </span>
      </div>

      {/* ファイル選択 */}
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFileChange}
        className="block text-sm text-[var(--color-text-sub)] file:mr-3 file:py-1.5 file:px-3 file:rounded-[var(--radius-sm)] file:border file:border-[var(--color-border)] file:text-sm file:bg-white file:text-[var(--color-text)] file:cursor-pointer hover:file:bg-[var(--color-bg-secondary)]"
      />

      {parseError && (
        <p className="text-sm text-[var(--color-error)]">{parseError}</p>
      )}

      {/* プレビュー */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-sub)]">
            <span className="font-medium text-[var(--color-text)]">{rows.length}件</span>
            のデータを確認しました。
          </p>

          <div className="overflow-x-auto border border-[var(--color-border)] rounded-[var(--radius-md)]">
            <table className="w-full text-xs">
              <thead className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
                <tr>
                  {["氏名", "カナ", "社員番号", "メール", "部署", "雇用形態", "入社日"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left font-semibold text-[var(--color-text-sub)] whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2 font-medium text-[var(--color-text)]">{r.name}</td>
                    <td className="px-3 py-2 text-[var(--color-text-sub)]">{r.nameKana ?? "—"}</td>
                    <td className="px-3 py-2 text-[var(--color-text-sub)]">{r.employeeCode ?? "—"}</td>
                    <td className="px-3 py-2 text-[var(--color-text-sub)]">{r.email ?? "—"}</td>
                    <td className="px-3 py-2 text-[var(--color-text-sub)]">{r.department ?? "—"}</td>
                    <td className="px-3 py-2 text-[var(--color-text-sub)]">{r.employmentType ?? "—"}</td>
                    <td className="px-3 py-2 text-[var(--color-text-sub)]">{r.joinedAt ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length > 10 && (
            <p className="text-xs text-[var(--color-text-muted)]">
              ※ 先頭10件のみ表示（合計 {rows.length} 件）
            </p>
          )}

          <Button
            type="button"
            variant="primary"
            onClick={handleImport}
            loading={isPending}
          >
            {rows.length}件を登録する
          </Button>
        </div>
      )}

      {result?.error && (
        <p className="text-sm text-[var(--color-error)]">{result.error}</p>
      )}
      {result?.success && (
        <p className="text-sm text-[#16A34A] font-medium">
          {result.insertedCount}件の受講者を登録しました。
        </p>
      )}
    </div>
  );
}
