/**
 * 申請パッケージ サービス
 *
 * 初回申請の遷移条件判定・アカウント発行シート生成などの業務ロジック。
 */

import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  HeadingLevel,
} from "docx";
import { createClient } from "@/lib/supabase/server";
import type {
  PreApplicationReadinessResult,
  ReadinessMissingItem,
  AccountSheetRow,
} from "@/types/application-packages";
import { EMPLOYMENT_TYPE_LABELS } from "@/lib/constants/case-status";

// ------------------------------------------------------------
// 初回申請可否チェック
// ------------------------------------------------------------

/**
 * 指定案件が初回申請（pre_application_ready）遷移条件を満たしているか判定する。
 *
 * 条件:
 * - 必須書類（required_flag=true）がすべて approved または received 状態
 * - 差戻し中（returned）の書類がない
 *
 * @returns ready=true なら遷移可能。false なら missingItems に不足内容を返す。
 */
export async function checkPreApplicationReadiness(
  caseId: string
): Promise<PreApplicationReadinessResult> {
  const supabase = await createClient();

  const { data: requirements, error } = await supabase
    .from("document_requirements")
    .select(
      `id, required_flag, status,
       document_types ( name ),
       participants ( name )`
    )
    .eq("case_id", caseId);

  if (error) throw new Error(error.message);

  const missingItems: ReadinessMissingItem[] = [];
  let insufficientRequired = 0;
  let returnedCount = 0;

  for (const req of requirements ?? []) {
    const dt = req["document_types"] as { name?: unknown } | null | undefined;
    const pt = req["participants"]   as { name?: unknown } | null | undefined;
    const typeName      = dt && !Array.isArray(dt) ? dt["name"] : undefined;
    const participantName = pt && !Array.isArray(pt) ? pt["name"] : undefined;
    const label = participantName
      ? `${String(participantName)} / ${String(typeName ?? "")}`
      : String(typeName ?? "");

    if (req["status"] === "returned") {
      returnedCount++;
      missingItems.push({ label, reason: "returned" });
    } else if (
      req["required_flag"] === true &&
      req["status"] !== "approved" &&
      req["status"] !== "received"
    ) {
      insufficientRequired++;
      missingItems.push({ label, reason: "not_submitted" });
    }
  }

  return {
    ready:                insufficientRequired === 0 && returnedCount === 0,
    insufficientRequired,
    returnedCount,
    missingItems,
  };
}

// ------------------------------------------------------------
// アカウント発行シート CSV 行データ生成
// ------------------------------------------------------------

/**
 * 案件の受講者からアカウント発行シート用の行データを生成する。
 * 対象は learner_status が excluded 以外の受講者。
 */
export async function buildAccountSheetRows(caseId: string): Promise<AccountSheetRow[]> {
  const supabase = await createClient();

  const { data: participants, error } = await supabase
    .from("participants")
    .select("employee_code, name, name_kana, email, department, employment_type, joined_at, learner_status")
    .eq("case_id", caseId)
    .neq("learner_status", "excluded")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return (participants ?? []).map((p, idx) => ({
    no:             idx + 1,
    employeeCode:   String(p["employee_code"] ?? ""),
    name:           String(p["name"] ?? ""),
    nameKana:       String(p["name_kana"] ?? ""),
    email:          String(p["email"] ?? ""),
    department:     String(p["department"] ?? ""),
    employmentType: EMPLOYMENT_TYPE_LABELS[String(p["employment_type"] ?? "")] ?? String(p["employment_type"] ?? ""),
    joinedAt:       String(p["joined_at"] ?? ""),
  }));
}

// ------------------------------------------------------------
// アカウント発行シート CSV 文字列生成
// ------------------------------------------------------------

const CSV_HEADERS = ["No", "社員番号", "氏名", "氏名（カナ）", "メールアドレス", "部署", "雇用形態", "入社日"];

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildAccountSheetCsv(rows: AccountSheetRow[]): string {
  const lines: string[] = [];
  // BOM付きUTF-8（Excelで文字化けしないよう）
  lines.push("\uFEFF" + CSV_HEADERS.join(","));

  for (const row of rows) {
    const fields = [
      String(row.no),
      row.employeeCode,
      row.name,
      row.nameKana,
      row.email,
      row.department,
      row.employmentType,
      row.joinedAt,
    ];
    lines.push(fields.map(escapeCsvField).join(","));
  }

  return lines.join("\r\n");
}

// ------------------------------------------------------------
// アカウント発行シート Word (.docx) 生成
// ------------------------------------------------------------

export interface AccountSheetDocxInput {
  organizationName: string;
  caseCode: string;
  courseName: string;
  trainingStart: string | null;
  trainingEnd: string | null;
  issuedDateLabel: string;
  rows: AccountSheetRow[];
}

const BORDER_THIN = {
  top:    { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
  left:   { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
  right:  { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
};

function infoRow(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: label, bold: true, size: 22, font: "Meiryo" }),
      new TextRun({ text: `　${value}`, size: 22, font: "Meiryo" }),
    ],
  });
}

export async function buildAccountSheetDocx(input: AccountSheetDocxInput): Promise<Buffer> {
  const periodLabel =
    input.trainingStart && input.trainingEnd
      ? `${input.trainingStart} 〜 ${input.trainingEnd}`
      : input.trainingStart ?? input.trainingEnd ?? "—";

  const headerCells = (["No", "氏名", "氏名（カナ）", "ログインID", "部署"] as const).map(
    (text) =>
      new TableCell({
        borders: BORDER_THIN,
        shading: { fill: "F5F5F5" },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text, bold: true, size: 20, font: "Meiryo" })],
          }),
        ],
      })
  );

  const dataRows = input.rows.map(
    (r) =>
      new TableRow({
        children: [
          new TableCell({
            borders: BORDER_THIN,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: String(r.no), size: 20, font: "Meiryo" })],
              }),
            ],
          }),
          new TableCell({
            borders: BORDER_THIN,
            children: [new Paragraph({ children: [new TextRun({ text: r.name, size: 20, font: "Meiryo" })] })],
          }),
          new TableCell({
            borders: BORDER_THIN,
            children: [new Paragraph({ children: [new TextRun({ text: r.nameKana, size: 20, font: "Meiryo" })] })],
          }),
          new TableCell({
            borders: BORDER_THIN,
            children: [new Paragraph({ children: [new TextRun({ text: r.employeeCode, size: 20, font: "Meiryo" })] })],
          }),
          new TableCell({
            borders: BORDER_THIN,
            children: [new Paragraph({ children: [new TextRun({ text: r.department, size: 20, font: "Meiryo" })] })],
          }),
        ],
      })
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Meiryo", size: 22 },
        },
      },
    },
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: "アカウント発行シート",
                bold: true,
                size: 36,
                font: "Meiryo",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 360 },
            children: [new TextRun({ text: `出力日：${input.issuedDateLabel}`, size: 20, font: "Meiryo" })],
          }),
          infoRow("会社名：", input.organizationName),
          infoRow("研修コース：", input.courseName),
          infoRow("研修期間：", periodLabel),
          infoRow("対象人数：", `${input.rows.length}名`),
          new Paragraph({ spacing: { after: 240 }, children: [] }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [new TableRow({ children: headerCells, tableHeader: true }), ...dataRows],
          }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

// ------------------------------------------------------------
// 差戻し対応: 案件が returned ステータスに戻すべき状態かチェック
// ------------------------------------------------------------

/**
 * 差戻し書類が1件以上存在する場合は true を返す。
 * 差戻し対応フローの入口判定に使用する。
 */
export async function hasReturnedDocuments(caseId: string): Promise<boolean> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("document_requirements")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId)
    .eq("status", "returned");

  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
