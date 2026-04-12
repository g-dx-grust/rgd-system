/**
 * 最終申請 / 完了判定 サービス
 *
 * FR-072: 視聴ログ・アンケート・証憑・受講完了状況の最終確認が
 * すべて完了していないと最終申請連携へ進めない。
 */

import { listSurveys } from "@/server/repositories/surveys";
import { listFinalReviewItems } from "@/server/repositories/final-review";
import { createClient } from "@/lib/supabase/server";
import type { FinalReadinessResult } from "@/types/surveys";

// ------------------------------------------------------------
// 未回収証憑の有無
// ------------------------------------------------------------

async function hasUncollectedEvidence(caseId: string): Promise<boolean> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("evidence_items")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId)
    .is("deleted_at", null)
    .in("status", ["pending", "insufficient"]);

  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

// ------------------------------------------------------------
// 完了条件チェック
// ------------------------------------------------------------

export async function checkFinalReadiness(
  caseId: string
): Promise<FinalReadinessResult> {
  const [surveys, reviewItems, hasEvidenceUncollected] = await Promise.all([
    listSurveys(caseId),
    listFinalReviewItems(caseId),
    hasUncollectedEvidence(caseId),
  ]);

  const surveyTotal     = surveys.length;
  const surveyResponded = surveys.filter(
    (s) => s.status === "responded" || s.status === "skipped"
  ).length;
  const surveyAllResponded = surveyTotal === 0 || surveyResponded === surveyTotal;

  const reviewTotal   = reviewItems.length;
  const reviewChecked = reviewItems.filter((i) => i.isChecked).length;
  const allItemsChecked = reviewTotal === 0 || reviewChecked === reviewTotal;

  const missingItems: FinalReadinessResult["missingItems"] = [];

  surveys
    .filter((s) => s.status !== "responded" && s.status !== "skipped")
    .forEach((s) => {
      missingItems.push({
        label:  s.participantName ? `アンケート未回収: ${s.participantName}` : "アンケート未回収",
        reason: "survey_not_responded",
      });
    });

  reviewItems
    .filter((i) => !i.isChecked)
    .forEach((i) => {
      missingItems.push({ label: i.label, reason: "review_item_unchecked" });
    });

  if (hasEvidenceUncollected) {
    missingItems.push({ label: "未回収の証憑が残っています", reason: "evidence_uncollected" });
  }

  const ready = surveyAllResponded && allItemsChecked && !hasEvidenceUncollected;

  return {
    ready,
    surveyRespondedCount:   surveyResponded,
    surveyTotalCount:       surveyTotal,
    surveyAllResponded,
    reviewItemsChecked:     reviewChecked,
    reviewItemsTotal:       reviewTotal,
    allItemsChecked,
    hasEvidenceUncollected,
    missingItems,
  };
}
