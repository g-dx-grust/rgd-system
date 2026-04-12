/**
 * CSV Adapter
 *
 * LMS から出力された CSV ファイルを取り込み、共通形式に変換する。
 * 期待するカラム（ヘッダー行必須）:
 *   lms_user_id, progress_rate, is_completed, last_access_at, total_watch_seconds
 *
 * - is_completed: "true" / "1" / "yes" → true
 * - last_access_at: ISO 8601 または "YYYY/MM/DD HH:mm:ss" 形式
 * - progress_rate: 0〜100 の数値（"%" 付きも許容）
 */

import type { LmsAdapter, LmsProgressRecord, LmsSyncResult } from "../adapter";

/** CSV の各行をパースした生データ */
interface CsvRow {
  lms_user_id?: string;
  progress_rate?: string;
  is_completed?: string;
  last_access_at?: string;
  total_watch_seconds?: string;
  [key: string]: string | undefined;
}

function parseBool(val: string | undefined): boolean {
  if (!val) return false;
  return ["true", "1", "yes", "完了"].includes(val.trim().toLowerCase());
}

function parseDate(val: string | undefined): Date | null {
  if (!val || val.trim() === "") return null;
  // "YYYY/MM/DD HH:mm:ss" → ISO 変換
  const normalized = val.trim().replace(/\//g, "-");
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

function parseRate(val: string | undefined): number {
  if (!val) return 0;
  const num = parseFloat(val.replace("%", "").trim());
  if (isNaN(num)) return 0;
  return Math.min(100, Math.max(0, num));
}

function parseCsv(content: string): CsvRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: CsvRow = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}

export class CsvLmsAdapter implements LmsAdapter {
  readonly adapterType = "csv" as const;

  async fetchProgress(source?: string): Promise<LmsSyncResult> {
    if (!source) {
      return {
        totalRecords: 0,
        successRecords: 0,
        errorRecords: 0,
        errors: [{ row: 0, message: "CSVデータが渡されませんでした" }],
        records: [],
      };
    }

    const rows = parseCsv(source);
    const records: LmsProgressRecord[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    rows.forEach((row, idx) => {
      const lineNo = idx + 2; // ヘッダー行 = 1行目

      const lmsUserId = row["lms_user_id"]?.trim();
      if (!lmsUserId) {
        errors.push({ row: lineNo, message: "lms_user_id が空です" });
        return;
      }

      const progressRate = parseRate(row["progress_rate"]);
      const isCompleted  = parseBool(row["is_completed"]);
      const lastAccessAt = parseDate(row["last_access_at"]);

      const totalWatchRaw = row["total_watch_seconds"]?.trim();
      const totalWatchSeconds =
        totalWatchRaw && totalWatchRaw !== ""
          ? parseInt(totalWatchRaw, 10)
          : null;

      records.push({
        lmsUserId,
        progressRate,
        isCompleted,
        lastAccessAt,
        totalWatchSeconds: totalWatchSeconds !== null && !isNaN(totalWatchSeconds)
          ? totalWatchSeconds
          : null,
        rawPayload: row as Record<string, unknown>,
      });
    });

    return {
      totalRecords:   rows.length,
      successRecords: records.length,
      errorRecords:   errors.length,
      errors,
      records,
    };
  }
}
