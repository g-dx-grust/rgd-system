-- ============================================================
-- Migration: specialist_cases に提出・最終完了記録カラム追加
-- 作成日:   2026-04-19
-- 前提:     20260419000009_specialist_portal.sql 完了済み
-- ============================================================

ALTER TABLE specialist_cases
  ADD COLUMN IF NOT EXISTS submitted_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submission_method     TEXT,
  ADD COLUMN IF NOT EXISTS final_completed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS final_completed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN specialist_cases.submitted_at       IS '労働局への書類提出完了日時（社労士が記録）';
COMMENT ON COLUMN specialist_cases.submission_method  IS '提出方法（例: 郵送 / 窓口持参 / 電子申請）';
COMMENT ON COLUMN specialist_cases.final_completed_at IS '最終申請完了マーク日時';
COMMENT ON COLUMN specialist_cases.final_completed_by IS '最終申請完了をマークしたユーザー';

CREATE INDEX IF NOT EXISTS idx_specialist_cases_submitted
  ON specialist_cases (submitted_at) WHERE submitted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_specialist_cases_final_completed
  ON specialist_cases (final_completed_at) WHERE final_completed_at IS NOT NULL;
