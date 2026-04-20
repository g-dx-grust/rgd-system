-- ============================================================
-- Migration: 運営会社（グラスト / エイム）分離
-- 作成日:   2026-04-19
-- 関連:     docs/revisions/2026-04-19_修正依頼.md ④
--           CLAUDE.md セクション7.5
-- 範囲:     マイグレーションのみ（RLS 更新・UI は別作業）
-- ============================================================

-- ------------------------------------------------------------
-- 運営会社マスタ
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS operating_companies (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT NOT NULL UNIQUE,        -- 内部コード: GRUST / AIM
  name        TEXT NOT NULL,               -- 表示名（法人名）
  short_code  TEXT NOT NULL UNIQUE,        -- 案件番号プレフィックス: GRA / AIM
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE operating_companies IS '運営会社マスタ（訓練校運営主体: 株式会社グラスト / エイム）';

CREATE TRIGGER operating_companies_updated_at
  BEFORE UPDATE ON operating_companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 固定 seed（2件のみ。この2社以外は追加しない運用）
INSERT INTO operating_companies (code, name, short_code, sort_order) VALUES
  ('GRUST', '株式会社グラスト', 'GRA', 10),
  ('AIM',   'エイム',           'AIM', 20)
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------
-- 会社別 案件番号採番シーケンス
-- ------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS cases_code_seq_grust START 1;
CREATE SEQUENCE IF NOT EXISTS cases_code_seq_aim   START 1;

-- ------------------------------------------------------------
-- 採番関数（会社別）
--   フォーマット: {short_code}-YYYYMMDD-0001 （例: GRA-20260419-0001）
--   既存関数は書き換えず、新関数として追加
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_case_code(p_operating_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_company_code TEXT;
  v_short_code   TEXT;
  v_seq_val      BIGINT;
  v_date_part    TEXT;
BEGIN
  SELECT code, short_code
    INTO v_company_code, v_short_code
    FROM operating_companies
   WHERE id = p_operating_company_id
     AND is_active = TRUE;

  IF v_company_code IS NULL THEN
    RAISE EXCEPTION '運営会社が見つかりません: %', p_operating_company_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  v_date_part := TO_CHAR(NOW() AT TIME ZONE 'Asia/Tokyo', 'YYYYMMDD');

  IF v_company_code = 'GRUST' THEN
    v_seq_val := NEXTVAL('cases_code_seq_grust');
  ELSIF v_company_code = 'AIM' THEN
    v_seq_val := NEXTVAL('cases_code_seq_aim');
  ELSE
    RAISE EXCEPTION '未対応の運営会社コード: %', v_company_code;
  END IF;

  RETURN v_short_code || '-' || v_date_part || '-' || LPAD(v_seq_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_case_code(UUID)
  IS '運営会社別に案件番号を採番する。既存の cases_code_seq ベース DEFAULT を置換する用途。';

-- ------------------------------------------------------------
-- cases テーブルに operating_company_id を追加
-- ------------------------------------------------------------
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS operating_company_id UUID REFERENCES operating_companies(id);

-- 既存案件があればデフォルトで GRUST に割り当てる
UPDATE cases
   SET operating_company_id = (SELECT id FROM operating_companies WHERE code = 'GRUST')
 WHERE operating_company_id IS NULL;

-- NOT NULL 化
ALTER TABLE cases
  ALTER COLUMN operating_company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cases_operating_company_id
  ON cases (operating_company_id);

-- ------------------------------------------------------------
-- case_code の DEFAULT を破棄し、BEFORE INSERT トリガで会社別採番に置換
--   既存の採番関数/DEFAULT を「書き換え」ではなく「上から外して差し替え」
-- ------------------------------------------------------------
ALTER TABLE cases ALTER COLUMN case_code DROP DEFAULT;

CREATE OR REPLACE FUNCTION cases_assign_case_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.case_code IS NULL OR NEW.case_code = '' THEN
    IF NEW.operating_company_id IS NULL THEN
      RAISE EXCEPTION '案件番号採番には operating_company_id が必要です';
    END IF;
    NEW.case_code := generate_case_code(NEW.operating_company_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cases_assign_case_code_trg ON cases;
CREATE TRIGGER cases_assign_case_code_trg
  BEFORE INSERT ON cases
  FOR EACH ROW EXECUTE FUNCTION cases_assign_case_code();

-- ------------------------------------------------------------
-- user_profiles に operating_company_id を追加
--   NULL 可 … Admin / Operations Manager / Auditor など上位ロールは
--             両社横断のため運営会社未指定で運用する（具体的範囲は運用で確定）
-- ------------------------------------------------------------
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS operating_company_id UUID REFERENCES operating_companies(id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_operating_company_id
  ON user_profiles (operating_company_id);

COMMENT ON COLUMN user_profiles.operating_company_id
  IS '所属運営会社。NULL = 両社横断可（Admin 等上位ロール向け）。一般スタッフは必須設定運用。';

-- ------------------------------------------------------------
-- Row Level Security（読み取りのみ許可。書込ポリシーは別マイグレーションで）
-- ------------------------------------------------------------
ALTER TABLE operating_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY operating_companies_select ON operating_companies
  FOR SELECT TO authenticated USING (is_active = TRUE);
