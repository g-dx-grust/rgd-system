/**
 * 既存案件CSVインポートツール
 * ============================================================
 * 使用方法:
 *   npx tsx scripts/import-cases.ts --file ./import/cases.csv [--dry-run] [--batch-size 50]
 *
 * 環境変数（.env.local から読み込む）:
 *   NEXT_PUBLIC_SUPABASE_URL    Supabase プロジェクトURL
 *   SUPABASE_SERVICE_ROLE_KEY  サービスロールキー（RLSバイパス）
 *   IMPORT_DRY_RUN             "true" でドライラン（DBに書き込まない）
 *   IMPORT_BATCH_SIZE          バッチ処理件数（デフォルト50）
 *
 * CSVフォーマット（1行目はヘッダー）:
 *   必須列: organization_name, case_name, status
 *   任意列: case_code, subsidy_program_code, contract_date,
 *            planned_start_date, planned_end_date,
 *            pre_application_due_date, final_application_due_date,
 *            acceptance_date, summary,
 *            owner_email, contact_name, contact_email
 * ============================================================
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// -------------------------------------------------------
// 型定義
// -------------------------------------------------------

const VALID_STATUSES = [
  "case_received",
  "initial_guide_pending",
  "doc_collecting",
  "pre_application_ready",
  "pre_application_shared",
  "labor_office_waiting",
  "post_acceptance_processing",
  "training_in_progress",
  "completion_preparing",
  "final_reviewing",
  "final_application_shared",
  "completed",
  "on_hold",
  "returned",
  "cancelled",
] as const;

type CaseStatus = (typeof VALID_STATUSES)[number];

interface CsvRow {
  organization_name: string;
  case_name: string;
  status: string;
  case_code?: string;
  subsidy_program_code?: string;
  contract_date?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  pre_application_due_date?: string;
  final_application_due_date?: string;
  acceptance_date?: string;
  summary?: string;
  owner_email?: string;
  contact_name?: string;
  contact_email?: string;
}

interface ImportResult {
  row: number;
  organization_name: string;
  case_name: string;
  status: "ok" | "error" | "skip";
  message?: string;
  case_id?: string;
}

// -------------------------------------------------------
// 環境変数読み込み
// -------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(): Record<string, string> {
  const envPath = resolve(__dirname, "../.env.local");
  if (!existsSync(envPath)) {
    console.error("❌ .env.local が見つかりません。");
    process.exit(1);
  }
  return Object.fromEntries(
    readFileSync(envPath, "utf-8")
      .split("\n")
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
}

// -------------------------------------------------------
// CSVパーサー（依存ライブラリなし）
// -------------------------------------------------------

function parseCsv(content: string): CsvRow[] {
  const lines = content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim());

  if (lines.length < 2) {
    throw new Error("CSVにヘッダーとデータ行が必要です");
  }

  const headers = splitCsvLine(lines[0]).map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, "_")
  );

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (values[i] ?? "").trim();
    });
    return row as unknown as CsvRow;
  });
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// -------------------------------------------------------
// バリデーション
// -------------------------------------------------------

function validateRow(
  row: CsvRow
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!row.organization_name?.trim()) {
    errors.push("organization_name は必須です");
  }
  if (!row.case_name?.trim()) {
    errors.push("case_name は必須です");
  }
  if (!row.status?.trim()) {
    errors.push("status は必須です");
  } else if (!VALID_STATUSES.includes(row.status as CaseStatus)) {
    errors.push(
      `status "${row.status}" は無効です。有効値: ${VALID_STATUSES.join(", ")}`
    );
  }

  const dateFields: (keyof CsvRow)[] = [
    "contract_date",
    "planned_start_date",
    "planned_end_date",
    "pre_application_due_date",
    "final_application_due_date",
    "acceptance_date",
  ];
  for (const field of dateFields) {
    const val = row[field];
    if (val && !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      errors.push(`${field} は YYYY-MM-DD 形式で指定してください（値: ${val}）`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// -------------------------------------------------------
// インポート処理
// -------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = ReturnType<typeof createClient<any>>;

async function importRows(
  rows: CsvRow[],
  supabase: AnySupabaseClient,
  options: { dryRun: boolean; batchSize: number }
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];

  // 助成金種別マスタを事前取得
  const { data: subsidyPrograms, error: spError } = await supabase
    .from("subsidy_programs")
    .select("id, code");
  if (spError) throw new Error(`助成金種別マスタ取得失敗: ${spError.message}`);
   
  const subsidyMap = new Map<string, string>(
    (subsidyPrograms ?? []).map((s: { code: string; id: string }) => [s.code, s.id])
  );

  for (let i = 0; i < rows.length; i += options.batchSize) {
    const batch = rows.slice(i, i + options.batchSize);
    console.log(
      `\n📦 バッチ ${Math.floor(i / options.batchSize) + 1}: 行 ${i + 2}〜${Math.min(i + options.batchSize + 1, rows.length + 1)}`
    );

    for (let j = 0; j < batch.length; j++) {
      const row = batch[j];
      const rowNum = i + j + 2; // ヘッダーを1行目として2始まり

      // バリデーション
      const { valid, errors } = validateRow(row);
      if (!valid) {
        console.log(`  ❌ 行${rowNum}: バリデーションエラー — ${errors.join(" / ")}`);
        results.push({
          row: rowNum,
          organization_name: row.organization_name,
          case_name: row.case_name,
          status: "error",
          message: errors.join(" / "),
        });
        continue;
      }

      try {
        // 1. 企業を upsert（法人名で検索・なければ作成）
        let orgId: string;
        if (!options.dryRun) {
          const { data: existingOrg } = await supabase
            .from("organizations")
            .select("id")
            .eq("legal_name", row.organization_name.trim())
            .is("deleted_at", null)
            .limit(1)
            .single();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (existingOrg as any) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            orgId = (existingOrg as any).id as string;
          } else {
            const { data: newOrg, error: orgErr } = await supabase
              .from("organizations")
              .insert({ legal_name: row.organization_name.trim() })
              .select("id")
              .single();
            if (orgErr || !newOrg)
              throw new Error(`企業作成失敗: ${orgErr?.message}`);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            orgId = (newOrg as any).id as string;
          }
        } else {
          orgId = "dry-run-org-id";
        }

        // 2. 担当者メールからユーザーIDを解決
        let ownerUserId: string | null = null;
        if (row.owner_email && !options.dryRun) {
          const { data: userProfile } = await supabase
            .from("user_profiles")
            .select("id")
            .eq("email", row.owner_email.trim())
            .is("deleted_at", null)
            .limit(1)
            .single();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ownerUserId = (userProfile as any)?.id ?? null;
          if (!ownerUserId) {
            console.log(
              `    ⚠️  owner_email "${row.owner_email}" のユーザーが見つかりません。owner_user_id は NULL に設定します。`
            );
          }
        }

        // 3. 助成金種別IDの解決
        let subsidyProgramId: string | null = null;
        if (row.subsidy_program_code) {
          subsidyProgramId = subsidyMap.get(row.subsidy_program_code) ?? null;
          if (!subsidyProgramId) {
            console.log(
              `    ⚠️  subsidy_program_code "${row.subsidy_program_code}" が見つかりません。NULL に設定します。`
            );
          }
        }

        // 4. 案件を INSERT（case_code が指定されていればそれを使用）
        const casePayload: Record<string, unknown> = {
          organization_id: orgId,
          case_name: row.case_name.trim(),
          status: row.status as CaseStatus,
          subsidy_program_id: subsidyProgramId,
          owner_user_id: ownerUserId,
          summary: row.summary?.trim() || null,
          contract_date: row.contract_date || null,
          planned_start_date: row.planned_start_date || null,
          planned_end_date: row.planned_end_date || null,
          pre_application_due_date: row.pre_application_due_date || null,
          final_application_due_date: row.final_application_due_date || null,
          acceptance_date: row.acceptance_date || null,
        };

        // case_code が指定されている場合は上書き（自動生成を使わない）
        if (row.case_code?.trim()) {
          casePayload.case_code = row.case_code.trim();
        }

        let caseId = "dry-run-case-id";
        if (!options.dryRun) {
          const { data: newCase, error: caseErr } = await supabase
            .from("cases")
            .insert(casePayload)
            .select("id, case_code")
            .single();
          if (caseErr || !newCase)
            throw new Error(`案件作成失敗: ${caseErr?.message}`);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          caseId = (newCase as any).id as string;
          console.log(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            `  ✅ 行${rowNum}: 案件作成 [${(newCase as any).case_code}] ${row.case_name}`
          );
        } else {
          console.log(
            `  🔍 [DRY RUN] 行${rowNum}: ${row.organization_name} / ${row.case_name} (${row.status})`
          );
        }

        // 5. 連絡先を登録（contact_name が指定されている場合）
        if (row.contact_name && !options.dryRun) {
          await supabase.from("organization_contacts").insert({
            organization_id: orgId,
            name: row.contact_name.trim(),
            email: row.contact_email?.trim() || null,
            is_primary: true,
          });
        }

        results.push({
          row: rowNum,
          organization_name: row.organization_name,
          case_name: row.case_name,
          status: "ok",
          case_id: caseId,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`  ❌ 行${rowNum}: ${message}`);
        results.push({
          row: rowNum,
          organization_name: row.organization_name,
          case_name: row.case_name,
          status: "error",
          message,
        });
      }
    }
  }

  return results;
}

// -------------------------------------------------------
// 引数パーサー
// -------------------------------------------------------

function parseArgs(): {
  file: string;
  dryRun: boolean;
  batchSize: number;
} {
  const args = process.argv.slice(2);
  let file = "";
  let dryRun = process.env.IMPORT_DRY_RUN === "true";
  let batchSize = Number(process.env.IMPORT_BATCH_SIZE ?? "50");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) {
      file = args[++i];
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--batch-size" && args[i + 1]) {
      batchSize = Number(args[++i]);
    }
  }

  if (!file) {
    console.error(
      "使用方法: npx tsx scripts/import-cases.ts --file ./import/cases.csv [--dry-run] [--batch-size 50]"
    );
    process.exit(1);
  }

  return { file, dryRun, batchSize };
}

// -------------------------------------------------------
// エントリポイント
// -------------------------------------------------------

async function main() {
  const { file, dryRun, batchSize } = parseArgs();

  console.log("==============================================");
  console.log("RGDシステム — 案件CSVインポートツール");
  console.log(`ファイル  : ${file}`);
  console.log(`モード    : ${dryRun ? "🔍 DRY RUN（DBには書き込みません）" : "🚀 本実行"}`);
  console.log(`バッチサイズ: ${batchSize}`);
  console.log("==============================================\n");

  // 環境変数
  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "❌ NEXT_PUBLIC_SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が設定されていません。"
    );
    process.exit(1);
  }

  // Supabase クライアント（service_role でRLSバイパス）
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // CSVファイル読み込み
  const csvPath = resolve(process.cwd(), file);
  if (!existsSync(csvPath)) {
    console.error(`❌ ファイルが見つかりません: ${csvPath}`);
    process.exit(1);
  }

  const csvContent = readFileSync(csvPath, "utf-8");
  let rows: CsvRow[];

  try {
    rows = parseCsv(csvContent);
  } catch (err) {
    console.error(`❌ CSVパース失敗: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  console.log(`📄 ${rows.length} 行を読み込みました\n`);

  // インポート実行
  const results = await importRows(rows, supabase, { dryRun, batchSize });

  // サマリー
  const ok = results.filter((r) => r.status === "ok").length;
  const error = results.filter((r) => r.status === "error").length;
  const skip = results.filter((r) => r.status === "skip").length;

  console.log("\n==============================================");
  console.log("インポート結果サマリー");
  console.log("==============================================");
  console.log(`  ✅ 成功  : ${ok} 件`);
  console.log(`  ❌ エラー: ${error} 件`);
  console.log(`  ⏭️  スキップ: ${skip} 件`);
  console.log(`  合計    : ${results.length} 件`);
  if (dryRun) {
    console.log("\n⚠️  DRY RUN モードのため、DBへの書き込みは行いませんでした。");
    console.log("   本実行する場合は --dry-run オプションを外してください。");
  }
  console.log("==============================================");

  if (error > 0) {
    console.log("\n❌ エラーがあった行:");
    results
      .filter((r) => r.status === "error")
      .forEach((r) =>
        console.log(`  行${r.row}: ${r.organization_name} / ${r.case_name} — ${r.message}`)
      );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ 予期しないエラー:", err);
  process.exit(1);
});
