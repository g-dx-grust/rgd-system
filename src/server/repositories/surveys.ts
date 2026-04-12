/**
 * アンケート リポジトリ
 *
 * surveys テーブルへのアクセス。
 * サーバーサイド（Server Action / Route Handler）限定。
 */

import { createClient } from "@/lib/supabase/server";
import type {
  Survey,
  SurveyStatus,
  CreateSurveyInput,
} from "@/types/surveys";

// ------------------------------------------------------------
// 型変換ヘルパー
// ------------------------------------------------------------

function toSurvey(row: Record<string, unknown>): Survey {
  const p = row["participant"] as Record<string, unknown> | null;
  return {
    id:              String(row["id"]),
    caseId:          String(row["case_id"]),
    participantId:   row["participant_id"] != null ? String(row["participant_id"]) : null,
    surveyType:      String(row["survey_type"]) as Survey["surveyType"],
    status:          String(row["status"]) as SurveyStatus,
    sentAt:          row["sent_at"] != null ? String(row["sent_at"]) : null,
    respondedAt:     row["responded_at"] != null ? String(row["responded_at"]) : null,
    sentTo:          row["sent_to"] != null ? String(row["sent_to"]) : null,
    note:            row["note"] != null ? String(row["note"]) : null,
    createdBy:       row["created_by"] != null ? String(row["created_by"]) : null,
    createdAt:       String(row["created_at"]),
    participantName: p?.["name"] != null ? String(p["name"]) : null,
  };
}

// ------------------------------------------------------------
// 案件のアンケート一覧
// ------------------------------------------------------------

export async function listSurveys(caseId: string): Promise<Survey[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("surveys")
    .select(
      `id, case_id, participant_id, survey_type, status,
       sent_at, responded_at, sent_to, note, created_by, created_at,
       participant:participants!surveys_participant_id_fkey ( name )`
    )
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toSurvey(r as Record<string, unknown>));
}

// ------------------------------------------------------------
// アンケート集計
// ------------------------------------------------------------

export interface SurveySummary {
  total:     number;
  notSent:   number;
  sent:      number;
  responded: number;
  skipped:   number;
}

export async function getSurveySummary(caseId: string): Promise<SurveySummary> {
  const surveys = await listSurveys(caseId);
  return {
    total:     surveys.length,
    notSent:   surveys.filter((s) => s.status === "not_sent").length,
    sent:      surveys.filter((s) => s.status === "sent").length,
    responded: surveys.filter((s) => s.status === "responded").length,
    skipped:   surveys.filter((s) => s.status === "skipped").length,
  };
}

// ------------------------------------------------------------
// アンケート作成
// ------------------------------------------------------------

export async function createSurvey(
  input: CreateSurveyInput,
  userId: string
): Promise<Survey> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("surveys")
    .insert({
      case_id:        input.caseId,
      participant_id: input.participantId ?? null,
      survey_type:    input.surveyType ?? "post_training",
      status:         "not_sent",
      sent_to:        input.sentTo ?? null,
      note:           input.note ?? null,
      created_by:     userId,
    })
    .select(
      `id, case_id, participant_id, survey_type, status,
       sent_at, responded_at, sent_to, note, created_by, created_at`
    )
    .single();

  if (error) throw new Error(error.message);
  return toSurvey(data as Record<string, unknown>);
}

// ------------------------------------------------------------
// アンケートステータス更新
// ------------------------------------------------------------

export async function updateSurveyStatus(
  surveyId: string,
  status: SurveyStatus,
  extra: { sentTo?: string; note?: string } = {}
): Promise<void> {
  const supabase = await createClient();

  const patch: Record<string, unknown> = { status };
  if (status === "sent")      patch["sent_at"]      = new Date().toISOString();
  if (status === "responded") patch["responded_at"] = new Date().toISOString();
  if (extra.sentTo !== undefined) patch["sent_to"]  = extra.sentTo;
  if (extra.note   !== undefined) patch["note"]      = extra.note;

  const { error } = await supabase
    .from("surveys")
    .update(patch)
    .eq("id", surveyId);

  if (error) throw new Error(error.message);
}

// ------------------------------------------------------------
// アンケート削除（論理削除）
// ------------------------------------------------------------

export async function deleteSurvey(surveyId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("surveys")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", surveyId);

  if (error) throw new Error(error.message);
}
