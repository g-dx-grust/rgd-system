/**
 * 案件ステータス定数
 *
 * CLAUDE.md セクション7 に定義されたステータスのみ使用可。
 * 勝手に追加禁止。
 */

export const CASE_STATUS = {
  CASE_RECEIVED:             'case_received',
  INITIAL_GUIDE_PENDING:     'initial_guide_pending',
  DOC_COLLECTING:            'doc_collecting',
  PRE_APPLICATION_READY:     'pre_application_ready',
  PRE_APPLICATION_SHARED:    'pre_application_shared',
  LABOR_OFFICE_WAITING:      'labor_office_waiting',
  POST_ACCEPTANCE_PROCESSING:'post_acceptance_processing',
  TRAINING_IN_PROGRESS:      'training_in_progress',
  COMPLETION_PREPARING:      'completion_preparing',
  FINAL_REVIEWING:           'final_reviewing',
  FINAL_APPLICATION_SHARED:  'final_application_shared',
  COMPLETED:                 'completed',
  ON_HOLD:                   'on_hold',
  RETURNED:                  'returned',
  CANCELLED:                 'cancelled',
} as const;

export type CaseStatus = typeof CASE_STATUS[keyof typeof CASE_STATUS];

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  case_received:              '案件受領',
  initial_guide_pending:      '初期案内準備中',
  doc_collecting:             '書類回収中',
  pre_application_ready:      '初回申請準備完了',
  pre_application_shared:     '初回申請連携済み',
  labor_office_waiting:       '労働局受理待ち',
  post_acceptance_processing: '受理後対応中',
  training_in_progress:       '受講進行中',
  completion_preparing:       '終了申請準備中',
  final_reviewing:            '視聴ログ最終確認中',
  final_application_shared:   '最終申請連携済み',
  completed:                  '完了',
  on_hold:                    '保留',
  returned:                   '差戻し',
  cancelled:                  'キャンセル',
};

/** 通常フロー順（エラー系除く） */
export const CASE_STATUS_ORDER: CaseStatus[] = [
  'case_received',
  'initial_guide_pending',
  'doc_collecting',
  'pre_application_ready',
  'pre_application_shared',
  'labor_office_waiting',
  'post_acceptance_processing',
  'training_in_progress',
  'completion_preparing',
  'final_reviewing',
  'final_application_shared',
  'completed',
];

/** ステータス → バッジvariant */
export const CASE_STATUS_VARIANT: Record<CaseStatus, 'default' | 'accent' | 'success' | 'warning' | 'error'> = {
  case_received:              'default',
  initial_guide_pending:      'default',
  doc_collecting:             'accent',
  pre_application_ready:      'accent',
  pre_application_shared:     'accent',
  labor_office_waiting:       'warning',
  post_acceptance_processing: 'accent',
  training_in_progress:       'accent',
  completion_preparing:       'accent',
  final_reviewing:            'warning',
  final_application_shared:   'accent',
  completed:                  'success',
  on_hold:                    'warning',
  returned:                   'error',
  cancelled:                  'error',
};

/** フィルター用オプション */
export const CASE_STATUS_OPTIONS = Object.entries(CASE_STATUS_LABELS).map(
  ([value, label]) => ({ value: value as CaseStatus, label })
);

// ------------------------------------------------------------
// 受講者ステータス
// ------------------------------------------------------------
export const LEARNER_STATUS = {
  PLANNED:   'planned',
  ACTIVE:    'active',
  COMPLETED: 'completed',
  EXCLUDED:  'excluded',
} as const;

export type LearnerStatus = typeof LEARNER_STATUS[keyof typeof LEARNER_STATUS];

export const LEARNER_STATUS_LABELS: Record<LearnerStatus, string> = {
  planned:   '受講予定',
  active:    '受講中',
  completed: '受講完了',
  excluded:  '対象外',
};

// ------------------------------------------------------------
// 雇用形態
// ------------------------------------------------------------
export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  regular:   '正規雇用',
  part_time: 'パートタイム',
  contract:  '有期契約',
  dispatch:  '派遣',
};

// ------------------------------------------------------------
// 担当者タイプ
// ------------------------------------------------------------
export const ASSIGNMENT_TYPE_LABELS: Record<string, string> = {
  owner:      '主担当',
  support:    'サポート',
  accounting: '経理担当',
};

// ------------------------------------------------------------
// タスク優先度
// ------------------------------------------------------------
export const TASK_PRIORITY_LABELS: Record<string, string> = {
  low:      '低',
  medium:   '中',
  high:     '高',
  critical: '緊急',
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  open:        '未着手',
  in_progress: '対応中',
  done:        '完了',
  skipped:     'スキップ',
};

// ------------------------------------------------------------
// 企業規模
// ------------------------------------------------------------
export const EMPLOYEE_SIZE_OPTIONS = [
  { value: '1-9',     label: '1〜9名' },
  { value: '10-49',   label: '10〜49名' },
  { value: '50-99',   label: '50〜99名' },
  { value: '100-299', label: '100〜299名' },
  { value: '300+',    label: '300名以上' },
];
