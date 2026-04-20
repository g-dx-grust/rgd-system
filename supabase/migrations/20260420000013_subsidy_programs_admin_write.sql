-- ============================================================
-- Migration: subsidy_programs 管理者書き込みポリシー追加
-- 作成日: 2026-04-20
-- 目的: 設定画面からの助成金種別追加で RLS エラーになる不具合を解消
-- ============================================================

ALTER TABLE subsidy_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subsidy_programs_insert_admin ON subsidy_programs;
CREATE POLICY subsidy_programs_insert_admin ON subsidy_programs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM user_profiles up
        JOIN roles r ON r.id = up.role_id
       WHERE up.id = auth.uid()
         AND r.code = 'admin'
         AND up.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS subsidy_programs_update_admin ON subsidy_programs;
CREATE POLICY subsidy_programs_update_admin ON subsidy_programs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM user_profiles up
        JOIN roles r ON r.id = up.role_id
       WHERE up.id = auth.uid()
         AND r.code = 'admin'
         AND up.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM user_profiles up
        JOIN roles r ON r.id = up.role_id
       WHERE up.id = auth.uid()
         AND r.code = 'admin'
         AND up.deleted_at IS NULL
    )
  );
