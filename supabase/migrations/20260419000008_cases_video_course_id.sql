-- ============================================================
-- Migration: cases.video_course_id 追加 + case_name nullable化
--            subsidy_programs.abbreviation / video_courses.display_template 追加
-- 作成日: 2026-04-19
-- 目的: 修正依頼② 案件名プルダウン化（助成金種別 × コース）
--       1案件 = 1コース（単一FK）、表示名はマスタ定義テンプレで合成
-- ============================================================

-- ------------------------------------------------------------
-- 1. subsidy_programs に略称カラムを追加
--    display_template 内の {abbreviation} 変数として使用
-- ------------------------------------------------------------
ALTER TABLE subsidy_programs
  ADD COLUMN IF NOT EXISTS abbreviation TEXT;

-- 既存レコードに略称を設定
UPDATE subsidy_programs SET abbreviation = '人材開発（特定）'  WHERE code = 'jinzai_kaihatsu';
UPDATE subsidy_programs SET abbreviation = '人材開発（一般）'  WHERE code = 'jinzai_kaihatsu_ippan';
UPDATE subsidy_programs SET abbreviation = '教育訓練給付'       WHERE code = 'kyoiku_kunren';
UPDATE subsidy_programs SET abbreviation = 'その他'             WHERE code = 'other';

-- ------------------------------------------------------------
-- 2. video_courses に表示テンプレカラムを追加
--    NULL の場合は "{abbreviation} / {course}" がデフォルト
--    変数: {abbreviation} = subsidy_programs.abbreviation
--          {program}      = subsidy_programs.name
--          {course}       = video_courses.name
-- ------------------------------------------------------------
ALTER TABLE video_courses
  ADD COLUMN IF NOT EXISTS display_template TEXT;

-- ------------------------------------------------------------
-- 3. cases に video_course_id（単一コースFK）を追加
-- ------------------------------------------------------------
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS video_course_id UUID
    REFERENCES video_courses(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_cases_video_course_id ON cases (video_course_id);

-- ------------------------------------------------------------
-- 4. cases.case_name を nullable 化
--    既存自由入力データは廃棄（NULL化）
-- ------------------------------------------------------------
ALTER TABLE cases ALTER COLUMN case_name DROP NOT NULL;
UPDATE cases SET case_name = NULL;
