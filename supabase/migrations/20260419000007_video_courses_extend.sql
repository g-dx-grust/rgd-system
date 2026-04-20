-- ============================================================
-- Migration: video_courses 拡張 — ⑦-1 コースマスタ管理
-- 作成日: 2026-04-19
-- 目的: 案件プルダウン化（②）の前提として
--       subsidy_program_id / code カラムを追加し、
--       Admin 専用の書き込み RLS を整備する
-- ============================================================

-- ------------------------------------------------------------
-- カラム追加
-- ------------------------------------------------------------

-- 助成金種別FK（案件プルダウンで助成金 × コースの絞り込みに使用）
-- 既存行が存在しうるため nullable で追加。アプリ層で必須バリデーション
ALTER TABLE video_courses
  ADD COLUMN IF NOT EXISTS subsidy_program_id UUID REFERENCES subsidy_programs(id) ON DELETE RESTRICT;

-- コース略称（案件名の表示テンプレ等で使用する任意項目）
ALTER TABLE video_courses
  ADD COLUMN IF NOT EXISTS code TEXT;

-- ------------------------------------------------------------
-- インデックス
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_video_courses_subsidy_program_id
  ON video_courses (subsidy_program_id);

CREATE INDEX IF NOT EXISTS idx_video_courses_is_active
  ON video_courses (is_active);

-- ------------------------------------------------------------
-- updated_at 自動更新トリガー（既存テーブルへの適用）
-- ------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'video_courses_updated_at'
      AND tgrelid = 'video_courses'::regclass
  ) THEN
    CREATE TRIGGER video_courses_updated_at
      BEFORE UPDATE ON video_courses
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- RLS: Admin のみ書き込み可（SELECT は既存ポリシーで全認証済みユーザー可）
-- ------------------------------------------------------------

-- コース作成
CREATE POLICY "admin_insert_video_courses"
  ON video_courses FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code = 'admin'
        AND up.deleted_at IS NULL
    )
  );

-- コース更新（編集・無効化）
CREATE POLICY "admin_update_video_courses"
  ON video_courses FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code = 'admin'
        AND up.deleted_at IS NULL
    )
  );
