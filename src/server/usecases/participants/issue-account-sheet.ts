/**
 * アカウント発行シート Word 生成
 *
 * 案件の受講者一覧を Word（.docx）形式で出力する。
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { AccountSheetRow } from "@/types/application-packages";

// ---------------------------------------------------------------
// 入力型
// ---------------------------------------------------------------

export interface AccountSheetDocxInput {
  organizationName: string;
  caseCode:         string;
  courseName:       string;
  trainingStart:    string | null;
  trainingEnd:      string | null;
  issuedDateLabel:  string;
  rows:             AccountSheetRow[];
}

// ---------------------------------------------------------------
// 日付フォーマット（JST）
// ---------------------------------------------------------------

function formatJstDate(iso: string | null): string {
  if (!iso) return "—";
  const jst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}年${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日`;
}

// ---------------------------------------------------------------
// セルスタイル
// ---------------------------------------------------------------

const BORDER_THIN = {
  top:    { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
  left:   { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
  right:  { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
};

function labelCell(text: string): TableCell {
  return new TableCell({
    width: { size: 22, type: WidthType.PERCENTAGE },
    borders: BORDER_THIN,
    shading: { fill: "F5F5F5" },
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 22, font: "Noto Sans JP" })],
      }),
    ],
  });
}

function valueCell(text: string): TableCell {
  return new TableCell({
    width: { size: 78, type: WidthType.PERCENTAGE },
    borders: BORDER_THIN,
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 22, font: "Noto Sans JP" })],
      }),
    ],
  });
}

function headerCell(text: string): TableCell {
  return new TableCell({
    borders: BORDER_THIN,
    shading: { fill: "374151" },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text,
            size: 20,
            bold: true,
            color: "FFFFFF",
            font: "Noto Sans JP",
          }),
        ],
      }),
    ],
  });
}

function dataCell(text: string): TableCell {
  return new TableCell({
    borders: BORDER_THIN,
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 20, font: "Noto Sans JP" })],
      }),
    ],
  });
}

// ---------------------------------------------------------------
// Word 文書生成
// ---------------------------------------------------------------

export async function buildAccountSheetDocx(
  input: AccountSheetDocxInput
): Promise<Buffer> {
  const {
    organizationName,
    courseName,
    trainingStart,
    trainingEnd,
    issuedDateLabel,
    rows,
  } = input;

  const trainingPeriod = `${formatJstDate(trainingStart)} 〜 ${formatJstDate(trainingEnd)}`;

  const infoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [labelCell("会社名"),       valueCell(organizationName)] }),
      new TableRow({ children: [labelCell("研修期間"),     valueCell(trainingPeriod)] }),
      new TableRow({ children: [labelCell("研修コース名"), valueCell(courseName)] }),
      new TableRow({ children: [labelCell("総人数"),       valueCell(`${rows.length}名`)] }),
      new TableRow({ children: [labelCell("発行日"),       valueCell(issuedDateLabel)] }),
    ],
  });

  const participantTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell("No"),
          headerCell("氏名"),
          headerCell("氏名（カナ）"),
          headerCell("ログインID"),
          headerCell("ログインPW"),
          headerCell("部署"),
        ],
      }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: [
              dataCell(String(r.no)),
              dataCell(r.name),
              dataCell(r.nameKana),
              dataCell(r.employeeCode),
              dataCell(r.email),
              dataCell(r.department),
            ],
          })
      ),
    ],
  });

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Noto Sans JP", size: 22 } },
      },
    },
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: "アカウント発行シート",
                size: 36,
                bold: true,
                font: "Noto Sans JP",
              }),
            ],
          }),
          infoTable,
          new Paragraph({ children: [new TextRun("")], spacing: { after: 200 } }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: "■ 受講者一覧",
                size: 24,
                bold: true,
                font: "Noto Sans JP",
              }),
            ],
          }),
          participantTable,
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
