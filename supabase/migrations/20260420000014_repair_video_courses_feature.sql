-- ============================================================
-- Migration: video_courses 機能のスキーマ補修
-- 作成日: 2026-04-20
-- 目的:
--   - remote history と実スキーマの不整合で video_courses 系テーブルが
--     存在しない/不足している環境を回復する
--   - settings / cases で利用する最小限の schema を idempotent に整える
-- 背景:
--   - 過去 migration の version 重複により、一部 SQL が remote に反映されて
--     いない状態が発生したため
-- ============================================================

-- ------------------------------------------------------------
-- 1. video_courses / case_video_courses ベーステーブル
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS video_courses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  description   TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  display_order INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS case_video_courses (
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  video_course_id UUID NOT NULL REFERENCES video_courses(id) ON DELETE CASCADE,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by     UUID REFERENCES auth.users(id),
  PRIMARY KEY (case_id, video_course_id)
);

ALTER TABLE video_courses
  ADD COLUMN IF NOT EXISTS description   TEXT,
  ADD COLUMN IF NOT EXISTS is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS display_order INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE case_video_courses
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id);

COMMENT ON TABLE video_courses IS '案件名プルダウン用のコースマスタ';
COMMENT ON TABLE case_video_courses IS '案件 × コース 中間テーブル（後方互換用）';

CREATE INDEX IF NOT EXISTS idx_case_video_courses_case_id
  ON case_video_courses (case_id);

CREATE INDEX IF NOT EXISTS idx_case_video_courses_video_course_id
  ON case_video_courses (video_course_id);

-- ------------------------------------------------------------
-- 2. 助成金 × コース連携用の拡張カラム
-- ------------------------------------------------------------
ALTER TABLE subsidy_programs
  ADD COLUMN IF NOT EXISTS abbreviation TEXT;

UPDATE subsidy_programs SET abbreviation = '人材開発（特定）'  WHERE code = 'jinzai_kaihatsu'       AND abbreviation IS NULL;
UPDATE subsidy_programs SET abbreviation = '人材開発（一般）'  WHERE code = 'jinzai_kaihatsu_ippan' AND abbreviation IS NULL;
UPDATE subsidy_programs SET abbreviation = '教育訓練給付'       WHERE code = 'kyoiku_kunren'        AND abbreviation IS NULL;
UPDATE subsidy_programs SET abbreviation = 'その他'             WHERE code = 'other'                 AND abbreviation IS NULL;

ALTER TABLE video_courses
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS display_template TEXT,
  ADD COLUMN IF NOT EXISTS subsidy_program_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'video_courses_subsidy_program_id_fkey'
  ) THEN
    ALTER TABLE video_courses
      ADD CONSTRAINT video_courses_subsidy_program_id_fkey
      FOREIGN KEY (subsidy_program_id)
      REFERENCES subsidy_programs(id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_video_courses_subsidy_program_id
  ON video_courses (subsidy_program_id);

CREATE INDEX IF NOT EXISTS idx_video_courses_is_active
  ON video_courses (is_active);

-- ------------------------------------------------------------
-- 3. cases 側の単一コース FK
-- ------------------------------------------------------------
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS video_course_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cases_video_course_id_fkey'
  ) THEN
    ALTER TABLE cases
      ADD CONSTRAINT cases_video_course_id_fkey
      FOREIGN KEY (video_course_id)
      REFERENCES video_courses(id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_cases_video_course_id
  ON cases (video_course_id);

-- ------------------------------------------------------------
-- 4. updated_at トリガ
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
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
-- 5. RLS / Policies
-- ------------------------------------------------------------
ALTER TABLE video_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_video_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_video_courses" ON video_courses;
CREATE POLICY "authenticated_read_video_courses"
  ON video_courses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_video_courses" ON video_courses;
CREATE POLICY "admin_insert_video_courses"
  ON video_courses FOR INSERT TO authenticated
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

DROP POLICY IF EXISTS "admin_update_video_courses" ON video_courses;
CREATE POLICY "admin_update_video_courses"
  ON video_courses FOR UPDATE TO authenticated
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

DROP POLICY IF EXISTS "authenticated_read_case_video_courses" ON case_video_courses;
CREATE POLICY "authenticated_read_case_video_courses"
  ON case_video_courses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_manage_case_video_courses" ON case_video_courses;
CREATE POLICY "authenticated_manage_case_video_courses"
  ON case_video_courses FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
