-- ============================================================
-- Migration: 社労士が自分の specialist_cases を UPDATE できるポリシー追加
-- 作成日:   2026-04-19
-- 前提:     20260419000010_specialist_submission.sql 完了済み
--           (submitted_at / submission_method / final_completed_at / final_completed_by カラムが存在すること)
-- 用途:     recordSubmissionAction / markFinalCompleteAction から
--           社労士自身が提出記録・最終申請完了マークを記録できるようにする
-- ============================================================

CREATE POLICY specialist_cases_update_own ON specialist_cases
  FOR UPDATE TO authenticated
  USING (
    specialist_user_id = auth.uid()
    AND is_active = TRUE
    AND EXISTS (
      SELECT 1
      FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code = 'external_specialist'
        AND up.deleted_at IS NULL
    )
  )
  WITH CHECK (
    specialist_user_id = auth.uid()
  );

COMMENT ON POLICY specialist_cases_update_own ON specialist_cases
  IS '社労士が自身の担当案件に対して提出記録・最終申請完了マークを書き込めるポリシー。'
     'is_active = TRUE かつ external_specialist ロールのみ。'
     'is_active 自体の変更は内部ユーザーの specialist_cases_update_internal に限定。';
