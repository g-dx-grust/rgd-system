-- ============================================================
-- Migration: operating_companies 機能のスキーマ補修
-- 作成日: 2026-04-20
-- 目的:
--   - remote history と実スキーマの不整合で operating_companies 系 schema が
--     存在しない/不足している環境を回復する
--   - cases / user_profiles / 採番 / RLS の最小構成を idempotent に整える
-- 背景:
--   - 過去 migration の version 重複により、一部 SQL が remote に反映されて
--     いない状態が発生したため
-- ============================================================

-- ------------------------------------------------------------
-- 1. operating_companies ベーステーブル
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS operating_companies (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  short_code  TEXT NOT NULL UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE operating_companies
  ADD COLUMN IF NOT EXISTS code       TEXT,
  ADD COLUMN IF NOT EXISTS name       TEXT,
  ADD COLUMN IF NOT EXISTS short_code TEXT,
  ADD COLUMN IF NOT EXISTS is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'operating_companies_code_key'
  ) THEN
    ALTER TABLE operating_companies
      ADD CONSTRAINT operating_companies_code_key UNIQUE (code);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'operating_companies_short_code_key'
  ) THEN
    ALTER TABLE operating_companies
      ADD CONSTRAINT operating_companies_short_code_key UNIQUE (short_code);
  END IF;
END;
$$;

COMMENT ON TABLE operating_companies IS '運営会社マスタ（訓練校運営主体: 株式会社グラスト / エイム）';

INSERT INTO operating_companies (code, name, short_code, is_active, sort_order)
VALUES
  ('GRUST', '株式会社グラスト', 'GRA', TRUE, 10),
  ('AIM',   'エイム',           'AIM', TRUE, 20)
ON CONFLICT (code) DO NOTHING;

UPDATE operating_companies
   SET name = '株式会社グラスト',
       short_code = 'GRA',
       is_active = TRUE,
       sort_order = 10
 WHERE code = 'GRUST'
   AND (
     name IS NULL
     OR short_code IS NULL
     OR is_active IS NULL
     OR sort_order IS NULL
   );

UPDATE operating_companies
   SET name = 'エイム',
       short_code = 'AIM',
       is_active = TRUE,
       sort_order = 20
 WHERE code = 'AIM'
   AND (
     name IS NULL
     OR short_code IS NULL
     OR is_active IS NULL
     OR sort_order IS NULL
   );

DROP TRIGGER IF EXISTS operating_companies_updated_at ON operating_companies;
CREATE TRIGGER operating_companies_updated_at
  BEFORE UPDATE ON operating_companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- 2. 会社別採番シーケンス / 関数
-- ------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS cases_code_seq_grust START 1;
CREATE SEQUENCE IF NOT EXISTS cases_code_seq_aim   START 1;

CREATE OR REPLACE FUNCTION generate_case_code(p_operating_company_id UUID)
RETURNS TEXT
LANGUAGE sql
AS $generate_case_code$
  SELECT
    oc.short_code
    || '-'
    || TO_CHAR(NOW() AT TIME ZONE 'Asia/Tokyo', 'YYYYMMDD')
    || '-'
    || LPAD(
      CASE oc.code
        WHEN 'GRUST' THEN NEXTVAL('cases_code_seq_grust')::TEXT
        WHEN 'AIM'   THEN NEXTVAL('cases_code_seq_aim')::TEXT
        ELSE NULL
      END,
      4,
      '0'
    )
  FROM operating_companies oc
  WHERE oc.id = p_operating_company_id
    AND oc.is_active = TRUE
$generate_case_code$;

COMMENT ON FUNCTION generate_case_code(UUID)
  IS '運営会社別に案件番号を採番する。';

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

CREATE OR REPLACE FUNCTION normalize_operating_company_uuid(p_raw_value TEXT)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_normalized TEXT;
  v_company_id UUID;
BEGIN
  IF p_raw_value IS NULL OR BTRIM(p_raw_value) = '' THEN
    RETURN NULL;
  END IF;

  v_normalized := UPPER(BTRIM(p_raw_value));

  IF v_normalized ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN v_normalized::UUID;
  END IF;

  SELECT id
    INTO v_company_id
    FROM operating_companies
   WHERE code = v_normalized
      OR short_code = v_normalized
   LIMIT 1;

  RETURN v_company_id;
END;
$$;

-- ------------------------------------------------------------
-- 3. cases / user_profiles カラム補修
-- ------------------------------------------------------------
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS operating_company_id UUID;

DO $$
DECLARE
  v_udt_name TEXT;
BEGIN
  SELECT c.udt_name
    INTO v_udt_name
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND c.table_name = 'cases'
     AND c.column_name = 'operating_company_id';

  IF v_udt_name IS DISTINCT FROM 'uuid' THEN
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'cases_operating_company_id_fkey'
    ) THEN
      ALTER TABLE cases
        DROP CONSTRAINT cases_operating_company_id_fkey;
    END IF;

    ALTER TABLE cases
      ALTER COLUMN operating_company_id
      TYPE UUID
      USING normalize_operating_company_uuid(operating_company_id::TEXT);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cases_operating_company_id_fkey'
  ) THEN
    ALTER TABLE cases
      ADD CONSTRAINT cases_operating_company_id_fkey
      FOREIGN KEY (operating_company_id)
      REFERENCES operating_companies(id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

UPDATE cases
   SET operating_company_id = (
     SELECT id
     FROM operating_companies
     WHERE code = 'GRUST'
   )
 WHERE operating_company_id IS NULL;

ALTER TABLE cases
  ALTER COLUMN operating_company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cases_operating_company_id
  ON cases (operating_company_id);

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS operating_company_id UUID;

DO $$
DECLARE
  v_udt_name TEXT;
BEGIN
  SELECT c.udt_name
    INTO v_udt_name
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND c.table_name = 'user_profiles'
     AND c.column_name = 'operating_company_id';

  IF v_udt_name IS DISTINCT FROM 'uuid' THEN
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'user_profiles_operating_company_id_fkey'
    ) THEN
      ALTER TABLE user_profiles
        DROP CONSTRAINT user_profiles_operating_company_id_fkey;
    END IF;

    ALTER TABLE user_profiles
      ALTER COLUMN operating_company_id
      TYPE UUID
      USING normalize_operating_company_uuid(operating_company_id::TEXT);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_profiles_operating_company_id_fkey'
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT user_profiles_operating_company_id_fkey
      FOREIGN KEY (operating_company_id)
      REFERENCES operating_companies(id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_user_profiles_operating_company_id
  ON user_profiles (operating_company_id);

COMMENT ON COLUMN user_profiles.operating_company_id
  IS '所属運営会社。NULL = 両社横断可（Admin 等上位ロール向け）。一般スタッフは必須設定運用。';

-- ------------------------------------------------------------
-- 4. cases.case_code 採番トリガ
-- ------------------------------------------------------------
ALTER TABLE cases
  ALTER COLUMN case_code DROP DEFAULT;

DROP TRIGGER IF EXISTS cases_assign_case_code_trg ON cases;
CREATE TRIGGER cases_assign_case_code_trg
  BEFORE INSERT ON cases
  FOR EACH ROW EXECUTE FUNCTION cases_assign_case_code();

-- ------------------------------------------------------------
-- 5. RLS / Policies
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth_can_access_company(p_company_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.deleted_at IS NULL
      AND (
        up.operating_company_id IS NULL
        OR up.operating_company_id = p_company_id
      )
  )
$$;

COMMENT ON FUNCTION auth_can_access_company(UUID)
  IS '認証ユーザーが指定運営会社の案件にアクセス可能か判定。operating_company_id IS NULL の上位ロールは全社横断可。';

ALTER TABLE operating_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operating_companies_select ON operating_companies;
CREATE POLICY operating_companies_select ON operating_companies
  FOR SELECT TO authenticated USING (is_active = TRUE);

DROP POLICY IF EXISTS cases_select_internal ON cases;
DROP POLICY IF EXISTS cases_select_all_roles ON cases;
DROP POLICY IF EXISTS cases_insert_ops ON cases;
DROP POLICY IF EXISTS cases_update_ops ON cases;
DROP POLICY IF EXISTS cases_select_company ON cases;
DROP POLICY IF EXISTS cases_insert_company ON cases;
DROP POLICY IF EXISTS cases_update_company ON cases;

CREATE POLICY cases_select_company ON cases
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND auth_can_access_company(operating_company_id)
    AND EXISTS (
      SELECT 1
      FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );

CREATE POLICY cases_insert_company ON cases
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_can_access_company(operating_company_id)
    AND EXISTS (
      SELECT 1
      FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales')
        AND up.deleted_at IS NULL
    )
  );

CREATE POLICY cases_update_company ON cases
  FOR UPDATE TO authenticated
  USING (
    auth_can_access_company(operating_company_id)
    AND EXISTS (
      SELECT 1
      FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales')
        AND up.deleted_at IS NULL
    )
  );

COMMENT ON POLICY cases_select_company ON cases
  IS '内部ユーザーは自社案件のみ閲覧可。operating_company_id IS NULL の上位ロールは両社横断可。';

NOTIFY pgrst, 'reload schema';
