/**
 * テンプレート展開サービス
 *
 * 案件作成時にチェックリストテンプレート・書類要件テンプレートを
 * 案件固有のレコードへ展開する。
 */

import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------
// チェックリスト展開
// ---------------------------------------------------------------

/**
 * 案件作成時のチェックリスト項目を自動生成する。
 *
 * checklist_templates から全フェーズ共通テンプレートを取得し、
 * checklist_items テーブルに展開する。
 * subsidy_program_id = NULL のテンプレート（全種別共通）は必ず含む。
 * 指定した助成金種別に紐づくテンプレートも含む。
 *
 * @param caseId          作成された案件 ID
 * @param subsidyProgramId 助成金種別 ID（未選択の場合は undefined）
 */
export async function expandChecklistItems(
  caseId: string,
  subsidyProgramId?: string
): Promise<void> {
  const supabase = await createClient();

  // テンプレートと項目を取得（共通 + 指定種別）
  const { data: templates, error: tplError } = await supabase
    .from("checklist_templates")
    .select(
      `
      id, code, phase,
      checklist_template_items (
        id, label, required, sort_order
      )
      `
    )
    .eq("active", true)
    .or(
      subsidyProgramId
        ? `subsidy_program_id.is.null,subsidy_program_id.eq.${subsidyProgramId}`
        : "subsidy_program_id.is.null"
    )
    .order("sort_order", { ascending: true });

  if (tplError) throw new Error(tplError.message);
  if (!templates || templates.length === 0) return;

  const rows: Array<{
    case_id: string;
    template_item_id: string;
    phase: string;
    label: string;
    required: boolean;
    sort_order: number;
  }> = [];

  for (const tpl of templates) {
    const items = (tpl.checklist_template_items as Array<{
      id: string;
      label: string;
      required: boolean;
      sort_order: number;
    }>) ?? [];

    for (const item of items) {
      rows.push({
        case_id:          caseId,
        template_item_id: item.id,
        phase:            String(tpl.phase),
        label:            item.label,
        required:         item.required,
        sort_order:       item.sort_order,
      });
    }
  }

  if (rows.length === 0) return;

  const { error: insertError } = await supabase
    .from("checklist_items")
    .insert(rows);

  if (insertError) throw new Error(insertError.message);
}

// ---------------------------------------------------------------
// 書類要件展開（企業書類 — 案件作成時）
// ---------------------------------------------------------------

/**
 * 案件作成時に会社単位の書類要件を自動生成する。
 *
 * document_requirement_templates から scope = 'company' のテンプレートを取得し、
 * document_requirements テーブルに展開する。
 * subsidy_program_id = NULL のテンプレート（全種別共通）は必ず含む。
 * 指定した助成金種別に紐づくテンプレートも含む。
 *
 * @param caseId          作成された案件 ID
 * @param subsidyProgramId 助成金種別 ID（未選択の場合は undefined）
 */
export async function expandCompanyDocumentRequirements(
  caseId: string,
  subsidyProgramId?: string
): Promise<void> {
  const supabase = await createClient();

  const { data: templates, error: tplError } = await supabase
    .from("document_requirement_templates")
    .select("document_type_id, required_flag, sort_order")
    .eq("scope", "company")
    .eq("active", true)
    .or(
      subsidyProgramId
        ? `subsidy_program_id.is.null,subsidy_program_id.eq.${subsidyProgramId}`
        : "subsidy_program_id.is.null"
    )
    .order("sort_order", { ascending: true });

  if (tplError) throw new Error(tplError.message);
  if (!templates || templates.length === 0) return;

  const rows = templates.map((tpl) => ({
    case_id:          caseId,
    document_type_id: String(tpl.document_type_id),
    required_flag:    Boolean(tpl.required_flag),
  }));

  const { error: insertError } = await supabase
    .from("document_requirements")
    .insert(rows);

  if (insertError) throw new Error(insertError.message);
}

// ---------------------------------------------------------------
// 書類要件展開（受講者書類 — 受講者追加時）
// ---------------------------------------------------------------

/**
 * 受講者追加時に個人単位の書類要件を自動生成する。
 *
 * document_requirement_templates から scope = 'participant' のテンプレートを取得し、
 * document_requirements テーブルに展開する。
 *
 * @param caseId          案件 ID
 * @param participantId   追加された受講者 ID
 * @param subsidyProgramId 助成金種別 ID（未選択の場合は undefined）
 */
export async function expandParticipantDocumentRequirements(
  caseId: string,
  participantId: string,
  subsidyProgramId?: string
): Promise<void> {
  const supabase = await createClient();

  const { data: templates, error: tplError } = await supabase
    .from("document_requirement_templates")
    .select("document_type_id, required_flag, sort_order")
    .eq("scope", "participant")
    .eq("active", true)
    .or(
      subsidyProgramId
        ? `subsidy_program_id.is.null,subsidy_program_id.eq.${subsidyProgramId}`
        : "subsidy_program_id.is.null"
    )
    .order("sort_order", { ascending: true });

  if (tplError) throw new Error(tplError.message);
  if (!templates || templates.length === 0) return;

  const rows = templates.map((tpl) => ({
    case_id:          caseId,
    participant_id:   participantId,
    document_type_id: String(tpl.document_type_id),
    required_flag:    Boolean(tpl.required_flag),
  }));

  const { error: insertError } = await supabase
    .from("document_requirements")
    .insert(rows);

  if (insertError) throw new Error(insertError.message);
}
