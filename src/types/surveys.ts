/**
 * アンケート / 終了申請準備 型定義
 *
 * surveys / final_review_items / final_specialist_linkages テーブルに対応。
 */

// ------------------------------------------------------------
// アンケート (surveys)
// ------------------------------------------------------------

export type SurveyType   = 'post_training' | 'pre_training' | 'other';
export type SurveyStatus = 'not_sent' | 'sent' | 'responded' | 'skipped';

export interface Survey {
  id:            string;
  caseId:        string;
  participantId: string | null;
  surveyType:    SurveyType;
  status:        SurveyStatus;
  sentAt:        string | null;
  respondedAt:   string | null;
  sentTo:        string | null;
  note:          string | null;
  createdBy:     string | null;
  createdAt:     string;
  // 結合フィールド
  participantName?: string | null;
}

export interface CreateSurveyInput {
  caseId:        string;
  participantId?: string;
  surveyType?:   SurveyType;
  sentTo?:       string;
  note?:         string;
}

export interface UpdateSurveyStatusInput {
  status:      SurveyStatus;
  sentTo?:     string;
  note?:       string;
}

// ------------------------------------------------------------
// 終了申請準備チェックリスト (final_review_items)
// ------------------------------------------------------------

export type FinalReviewItemType =
  | 'viewing_log'
  | 'survey'
  | 'evidence'
  | 'lms_progress'
  | 'document'
  | 'other';

export interface FinalReviewItem {
  id:          string;
  caseId:      string;
  itemType:    FinalReviewItemType;
  label:       string;
  isChecked:   boolean;
  checkedBy:   string | null;
  checkedAt:   string | null;
  note:        string | null;
  sortOrder:   number;
  createdAt:   string;
  // 結合フィールド
  checkedByName?: string | null;
}

export interface CreateFinalReviewItemInput {
  caseId:     string;
  itemType:   FinalReviewItemType;
  label:      string;
  sortOrder?: number;
  note?:      string;
}

// ------------------------------------------------------------
// 最終社労士連携履歴 (final_specialist_linkages)
// ------------------------------------------------------------

export interface FinalSpecialistLinkage {
  id:        string;
  caseId:    string;
  packageId: string | null;
  linkedTo:  string | null;
  linkedAt:  string;
  note:      string | null;
  createdBy: string | null;
  createdAt: string;
  // 結合フィールド
  createdByName?: string | null;
}

export interface CreateFinalSpecialistLinkageInput {
  caseId:     string;
  packageId?: string;
  linkedTo?:  string;
  note?:      string;
}

// ------------------------------------------------------------
// 完了条件チェック結果
// ------------------------------------------------------------

export interface FinalReadinessResult {
  ready:                  boolean;
  surveyRespondedCount:   number;
  surveyTotalCount:       number;
  surveyAllResponded:     boolean;
  reviewItemsChecked:     number;
  reviewItemsTotal:       number;
  allItemsChecked:        boolean;
  hasEvidenceUncollected: boolean;
  missingItems:           FinalReadinessMissingItem[];
}

export interface FinalReadinessMissingItem {
  label:  string;
  reason: 'survey_not_responded' | 'review_item_unchecked' | 'evidence_uncollected';
}

// ------------------------------------------------------------
// ラベル定数
// ------------------------------------------------------------

export const SURVEY_STATUS_LABELS: Record<SurveyStatus, string> = {
  not_sent:  '未送付',
  sent:      '送付済み',
  responded: '回収済み',
  skipped:   'スキップ',
};

export const SURVEY_TYPE_LABELS: Record<SurveyType, string> = {
  post_training: '受講後アンケート',
  pre_training:  '受講前アンケート',
  other:         'その他',
};

export const FINAL_REVIEW_ITEM_TYPE_LABELS: Record<FinalReviewItemType, string> = {
  viewing_log:  '視聴ログ確認',
  survey:       'アンケート回収確認',
  evidence:     '証憑確認',
  lms_progress: 'LMS進捗確認',
  document:     '書類確認',
  other:        'その他',
};
