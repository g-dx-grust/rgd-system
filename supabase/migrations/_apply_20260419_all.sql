-- video_courses マスタ
CREATE TABLE IF NOT EXISTS video_courses (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  description   text,
  is_active     boolean     NOT NULL DEFAULT true,
  display_order integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 案件×動画コース 中間テーブル
CREATE TABLE IF NOT EXISTS case_video_courses (
  case_id         uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  video_course_id uuid NOT NULL REFERENCES video_courses(id) ON DELETE CASCADE,
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  assigned_by     uuid REFERENCES auth.users(id),
  PRIMARY KEY (case_id, video_course_id)
);

CREATE INDEX IF NOT EXISTS idx_case_video_courses_case_id ON case_video_courses(case_id);

-- RLS
ALTER TABLE video_courses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_video_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_video_courses"
  ON video_courses FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_read_case_video_courses"
  ON case_video_courses FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_manage_case_video_courses"
  ON case_video_courses FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- 請求書ファイル保管用カラム追加
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS file_name text;

CREATE INDEX IF NOT EXISTS idx_invoices_file_path
  ON invoices (file_path)
  WHERE file_path IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoice-files',
  'invoice-files',
  FALSE,
  104857600,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "invoice_files_upload_internal" ON storage.objects;
CREATE POLICY "invoice_files_upload_internal"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'invoice-files'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "invoice_files_select_internal" ON storage.objects;
CREATE POLICY "invoice_files_select_internal"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'invoice-files'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );
-- 修了証ファイル管理テーブル（案件単位）
CREATE TABLE IF NOT EXISTS case_completion_certificates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     uuid        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  file_path   text        NOT NULL,
  file_name   text        NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid        REFERENCES auth.users(id),
  deleted_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_completion_certs_case_id ON case_completion_certificates(case_id);

ALTER TABLE case_completion_certificates ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'completion-certificates',
  'completion-certificates',
  FALSE,
  104857600,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "completion_certificates_upload_internal" ON storage.objects;
CREATE POLICY "completion_certificates_upload_internal"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'completion-certificates'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "completion_certificates_select_internal" ON storage.objects;
CREATE POLICY "completion_certificates_select_internal"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'completion-certificates'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "authenticated_read_completion_certs" ON case_completion_certificates;
CREATE POLICY "authenticated_read_completion_certs"
  ON case_completion_certificates FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "authenticated_manage_completion_certs" ON case_completion_certificates;
CREATE POLICY "authenticated_manage_completion_certs"
  ON case_completion_certificates FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
-- ご案内書ファイル管理テーブル
CREATE TABLE IF NOT EXISTS case_guidance_files (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     uuid        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  file_path   text        NOT NULL,
  file_name   text        NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid        REFERENCES auth.users(id),
  deleted_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_guidance_files_case_id ON case_guidance_files(case_id);

ALTER TABLE case_guidance_files ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'guidance-files',
  'guidance-files',
  FALSE,
  104857600,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "guidance_files_upload_internal" ON storage.objects;
CREATE POLICY "guidance_files_upload_internal"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'guidance-files'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "guidance_files_select_internal" ON storage.objects;
CREATE POLICY "guidance_files_select_internal"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'guidance-files'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "authenticated_read_guidance_files" ON case_guidance_files;
CREATE POLICY "authenticated_read_guidance_files"
  ON case_guidance_files FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "authenticated_manage_guidance_files" ON case_guidance_files;
CREATE POLICY "authenticated_manage_guidance_files"
  ON case_guidance_files FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
-- タスク手動管理用の RLS 調整
DROP POLICY IF EXISTS tasks_insert_ops ON tasks;
CREATE POLICY tasks_insert_ops ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN (
          'admin',
          'operations_manager',
          'operations_staff',
          'sales',
          'accounting'
        )
        AND up.deleted_at IS NULL
    )
  );
-- ============================================================
-- Migration: 業務フロー仕様補足（2026-04-19 修正依頼 ⑥）
--   助成金受付書 / 研修感想文 の書類種別を追加。
--   既存の survey_response（アンケート回答）は変更しない。
--
--   運用: いずれも紙媒体で発生 → PDFスキャン → documents にアップロード。
--     - grant_receipt_document : 労働局発行の助成金受付書（紙PDFスキャン）
--     - training_reflection    : 研修感想文（紙回収 → PDFスキャン）
--
--   参考ドキュメント:
--     - docs/subsidy-training-ops-docs/10_business/10_asis_tobe_workflow.md §3-1
--     - docs/subsidy-training-ops-docs/20_product/24_external_integrations.md §10
-- ============================================================

INSERT INTO document_types (code, name, scope, reusable_level, description, sort_order)
VALUES
  (
    'grant_receipt_document',
    '助成金受付書',
    'case',
    'case',
    '労働局発行の紙受付書をPDFスキャンしてアップロードする（システム自動発行は行わない）',
    260
  ),
  (
    'training_reflection',
    '研修感想文',
    'participant',
    'participant',
    '紙で送付・回収した受講者の感想文をPDFスキャンしてアップロードする',
    170
  )
ON CONFLICT (code) DO NOTHING;

-- 既存の survey_response に description を補足（紙運用であることを明示）
UPDATE document_types
SET description = '紙で送付・回収した受講者アンケートをPDFスキャンしてアップロードする'
WHERE code = 'survey_response'
  AND (description IS NULL OR description = '');
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
-- ============================================================
-- Migration: 運営会社スコープ RLS ポリシー
-- 作成日:   2026-04-19
-- 前提:     20260419000006_operating_companies.sql 完了済み
--           (operating_companies, cases.operating_company_id,
--            user_profiles.operating_company_id が存在すること)
-- 確定:     両社横断可 = Admin / Operations Manager / Auditor
--           自社限定   = Operations Staff / Sales / Accounting
--           規則:       user_profiles.operating_company_id IS NULL
--                       → 上位ロール（両社横断）
--                       user_profiles.operating_company_id IS NOT NULL
--                       → 自社案件のみ
-- ============================================================

-- ------------------------------------------------------------
-- ヘルパー関数: 運営会社アクセス可否判定
--   NULL operating_company_id = 上位ロール（両社横断可）
--   非 NULL = 自社の案件のみアクセス可
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth_can_access_company(p_company_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
      AND up.deleted_at IS NULL
      AND (
        up.operating_company_id IS NULL
        OR up.operating_company_id = p_company_id
      )
  )
$$;

COMMENT ON FUNCTION auth_can_access_company(UUID)
  IS '認証ユーザーが指定運営会社の案件にアクセス可能か判定。'
     'operating_company_id IS NULL (Admin / Ops Manager / Auditor 等) は全社横断可。';

-- ============================================================
-- cases テーブル
-- ============================================================

DROP POLICY IF EXISTS cases_select_internal    ON cases;
DROP POLICY IF EXISTS cases_select_all_roles   ON cases;
DROP POLICY IF EXISTS cases_insert_ops         ON cases;
DROP POLICY IF EXISTS cases_update_ops         ON cases;
-- cases_select_client は USING(false) のまま残す（Phase 2 で実装）

-- SELECT: 内部ユーザー + 運営会社スコープ
--   上位ロール (operating_company_id IS NULL) → 全社横断・全件参照
--   一般スタッフ                              → 自社 + 担当案件のみ
CREATE POLICY cases_select_company ON cases
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND auth_can_access_company(operating_company_id)
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND (
      -- 全件参照ロール（両社横断想定ロール）
      EXISTS (
        SELECT 1 FROM user_profiles up
        JOIN roles r ON r.id = up.role_id
        WHERE up.id = auth.uid()
          AND r.code IN ('admin', 'operations_manager', 'auditor')
          AND up.deleted_at IS NULL
      )
      OR
      -- 自担当案件のみ
      (
        EXISTS (
          SELECT 1 FROM user_profiles up
          JOIN roles r ON r.id = up.role_id
          WHERE up.id = auth.uid()
            AND r.code IN ('operations_staff', 'sales', 'accounting')
            AND up.deleted_at IS NULL
        )
        AND (
          owner_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM case_assignments ca
            WHERE ca.case_id = cases.id AND ca.user_id = auth.uid()
          )
        )
      )
    )
  );

-- INSERT: ops ロール + 自社のみ
CREATE POLICY cases_insert_company ON cases
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_can_access_company(operating_company_id)
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales')
        AND up.deleted_at IS NULL
    )
  );

-- UPDATE: ops ロール + 自社のみ
CREATE POLICY cases_update_company ON cases
  FOR UPDATE TO authenticated
  USING (
    auth_can_access_company(operating_company_id)
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales')
        AND up.deleted_at IS NULL
    )
  );

-- ============================================================
-- participants テーブル（case_id 経由でスコープ判定）
-- ============================================================

DROP POLICY IF EXISTS participants_select_internal ON participants;
DROP POLICY IF EXISTS participants_insert_ops       ON participants;
DROP POLICY IF EXISTS participants_update_ops       ON participants;

CREATE POLICY participants_select_company ON participants
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = participants.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY participants_insert_company ON participants
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = participants.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY participants_update_company ON participants
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = participants.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- document_requirements テーブル（case_id 経由）
-- ============================================================

DROP POLICY IF EXISTS doc_req_select_internal ON document_requirements;
DROP POLICY IF EXISTS doc_req_insert_internal ON document_requirements;
DROP POLICY IF EXISTS doc_req_update_internal ON document_requirements;

CREATE POLICY doc_req_select_company ON document_requirements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = document_requirements.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY doc_req_insert_company ON document_requirements
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = document_requirements.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY doc_req_update_company ON document_requirements
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = document_requirements.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- documents テーブル（case_id 経由）
-- ============================================================

DROP POLICY IF EXISTS documents_select_internal ON documents;
DROP POLICY IF EXISTS documents_insert_internal ON documents;
DROP POLICY IF EXISTS documents_update_internal ON documents;
-- documents_select_client (a2 migration) はそのまま残す

CREATE POLICY documents_select_company ON documents
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = documents.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY documents_insert_company ON documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'sales')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = documents.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY documents_update_company ON documents
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = documents.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- upload_tokens テーブル（case_id 経由）
-- ============================================================

DROP POLICY IF EXISTS upload_tokens_select_internal ON upload_tokens;
DROP POLICY IF EXISTS upload_tokens_insert_internal ON upload_tokens;

CREATE POLICY upload_tokens_select_company ON upload_tokens
  FOR SELECT TO authenticated
  USING (
    expires_at > NOW()
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = upload_tokens.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY upload_tokens_insert_company ON upload_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = upload_tokens.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- application_packages テーブル（case_id 経由）
-- ============================================================

DROP POLICY IF EXISTS app_packages_select_internal ON application_packages;
DROP POLICY IF EXISTS app_packages_insert_internal ON application_packages;
DROP POLICY IF EXISTS app_packages_update_internal ON application_packages;
-- app_packages_select_specialist はそのまま残す（外部専門家は別軸での制御）

CREATE POLICY app_packages_select_company ON application_packages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = application_packages.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY app_packages_insert_company ON application_packages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = application_packages.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY app_packages_update_company ON application_packages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = application_packages.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- application_package_items テーブル（package_id → case_id 経由）
-- ============================================================

DROP POLICY IF EXISTS app_pkg_items_select_internal ON application_package_items;
DROP POLICY IF EXISTS app_pkg_items_insert_internal ON application_package_items;
DROP POLICY IF EXISTS app_pkg_items_delete_internal ON application_package_items;
-- app_pkg_items_select_specialist はそのまま残す

CREATE POLICY app_pkg_items_select_company ON application_package_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM application_packages ap
      JOIN cases c ON c.id = ap.case_id
      WHERE ap.id = application_package_items.package_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY app_pkg_items_insert_company ON application_package_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM application_packages ap
      JOIN cases c ON c.id = ap.case_id
      WHERE ap.id = application_package_items.package_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY app_pkg_items_delete_company ON application_package_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM application_packages ap
      JOIN cases c ON c.id = ap.case_id
      WHERE ap.id = application_package_items.package_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- invoices テーブル（case_id 経由）
-- ============================================================

DROP POLICY IF EXISTS invoices_select_internal ON invoices;
DROP POLICY IF EXISTS invoices_insert_internal ON invoices;
DROP POLICY IF EXISTS invoices_update_internal ON invoices;

CREATE POLICY invoices_select_company ON invoices
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = invoices.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY invoices_insert_company ON invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'accounting')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = invoices.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY invoices_update_company ON invoices
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'accounting')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = invoices.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- evidence_items テーブル（case_id 経由）
-- ============================================================

DROP POLICY IF EXISTS evidence_select_internal ON evidence_items;
DROP POLICY IF EXISTS evidence_insert_internal ON evidence_items;
DROP POLICY IF EXISTS evidence_update_internal ON evidence_items;

CREATE POLICY evidence_select_company ON evidence_items
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = evidence_items.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY evidence_insert_company ON evidence_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'accounting')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = evidence_items.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY evidence_update_company ON evidence_items
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff', 'accounting')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = evidence_items.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- sent_messages テーブル（case_id 経由）
-- ============================================================

DROP POLICY IF EXISTS sent_messages_select ON sent_messages;
DROP POLICY IF EXISTS sent_messages_insert ON sent_messages;

CREATE POLICY sent_messages_select_company ON sent_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = sent_messages.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY sent_messages_insert_company ON sent_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = sent_messages.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- tasks テーブル（case_id 経由）
-- ============================================================

DROP POLICY IF EXISTS tasks_select_internal ON tasks;
DROP POLICY IF EXISTS tasks_insert_ops       ON tasks;
DROP POLICY IF EXISTS tasks_update_ops       ON tasks;

CREATE POLICY tasks_select_company ON tasks
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = tasks.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY tasks_insert_company ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = tasks.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

CREATE POLICY tasks_update_company ON tasks
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = tasks.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- case_assignments テーブル（case_id 経由）
-- ============================================================
-- case_assignments_select (USING true) と
-- case_assignments_select_internal の両方を置換

DROP POLICY IF EXISTS case_assignments_select          ON case_assignments;
DROP POLICY IF EXISTS case_assignments_select_internal ON case_assignments;

CREATE POLICY case_assignments_select_company ON case_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = case_assignments.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );
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
-- ============================================================
-- Migration: ⑤ 社労士専用テーブル + RLS厳格化
-- 作成日:   2026-04-19
-- 前提:     20260419000007_rls_operating_company.sql 完了済み
--           (auth_can_access_company 関数が存在すること)
-- ============================================================

-- ============================================================
-- specialist_cases: 案件と社労士の紐付け（共有管理）
-- ============================================================
CREATE TABLE IF NOT EXISTS specialist_cases (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id             UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  specialist_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  shared_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  shared_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (case_id, specialist_user_id)
);

COMMENT ON TABLE specialist_cases IS '案件と社労士の紐付け（共有管理）';
COMMENT ON COLUMN specialist_cases.is_active IS 'FALSE にすることで共有を無効化（論理削除相当）';

CREATE TRIGGER specialist_cases_updated_at
  BEFORE UPDATE ON specialist_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_specialist_cases_case_id            ON specialist_cases (case_id);
CREATE INDEX IF NOT EXISTS idx_specialist_cases_specialist_user_id ON specialist_cases (specialist_user_id);
CREATE INDEX IF NOT EXISTS idx_specialist_cases_is_active          ON specialist_cases (is_active);

-- ============================================================
-- ヘルパー関数: 認証ユーザーが指定案件の担当社労士かどうか判定
-- specialist_cases 作成後に定義する
-- ============================================================
CREATE OR REPLACE FUNCTION auth_is_specialist_for_case(p_case_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM specialist_cases sc
    JOIN user_profiles up ON up.id = auth.uid()
    JOIN roles r ON r.id = up.role_id
    WHERE sc.case_id             = p_case_id
      AND sc.specialist_user_id  = auth.uid()
      AND sc.is_active           = TRUE
      AND r.code                 = 'external_specialist'
      AND up.deleted_at          IS NULL
  )
$$;

COMMENT ON FUNCTION auth_is_specialist_for_case(UUID)
  IS '認証ユーザーが指定案件の担当社労士かどうかを判定。'
     'specialist_cases.is_active = TRUE かつ external_specialist ロールのみ TRUE を返す。';

-- ============================================================
-- deficiency_requests: 労働局からの不備依頼
-- ============================================================
CREATE TABLE IF NOT EXISTS deficiency_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  description     TEXT NOT NULL,
  -- [{label: "書類名", note: "補足"}] 形式の JSONB
  required_files  JSONB NOT NULL DEFAULT '[]',
  deadline        DATE,
  status          TEXT NOT NULL DEFAULT 'open',
  responded_at    TIMESTAMPTZ,
  responded_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT deficiency_requests_status_check CHECK (
    status IN ('open', 'responded', 'resolved')
  )
);

COMMENT ON TABLE deficiency_requests IS '労働局からの不備依頼（社労士が入力、訓練会社が対応）';
COMMENT ON COLUMN deficiency_requests.required_files IS '必要ファイル一覧 [{label, note}]';
COMMENT ON COLUMN deficiency_requests.status IS 'open: 未対応 / responded: 社労士が対応済み入力 / resolved: 訓練会社が確認済み';

CREATE TRIGGER deficiency_requests_updated_at
  BEFORE UPDATE ON deficiency_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_deficiency_case_id   ON deficiency_requests (case_id);
CREATE INDEX IF NOT EXISTS idx_deficiency_status    ON deficiency_requests (status);
CREATE INDEX IF NOT EXISTS idx_deficiency_deadline  ON deficiency_requests (deadline);
CREATE INDEX IF NOT EXISTS idx_deficiency_deleted   ON deficiency_requests (deleted_at) WHERE deleted_at IS NULL;

-- ============================================================
-- specialist_comments: 社労士 ↔ 訓練会社スレッドコメント
-- ============================================================
CREATE TABLE IF NOT EXISTS specialist_comments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id             UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  author_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  body                TEXT NOT NULL,
  is_from_specialist  BOOLEAN NOT NULL DEFAULT FALSE,
  -- スレッド返信用 (NULL = ルートコメント)
  parent_id           UUID REFERENCES specialist_comments(id) ON DELETE SET NULL,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE specialist_comments IS '社労士↔訓練会社スレッド形式コメント（監査ログ対象）';
COMMENT ON COLUMN specialist_comments.is_from_specialist IS 'TRUE = 社労士発、FALSE = 訓練会社スタッフ発';
COMMENT ON COLUMN specialist_comments.parent_id IS 'スレッド返信の場合、元コメントのID';

CREATE TRIGGER specialist_comments_updated_at
  BEFORE UPDATE ON specialist_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_specialist_comments_case_id    ON specialist_comments (case_id);
CREATE INDEX IF NOT EXISTS idx_specialist_comments_author_id  ON specialist_comments (author_id);
CREATE INDEX IF NOT EXISTS idx_specialist_comments_parent_id  ON specialist_comments (parent_id);
CREATE INDEX IF NOT EXISTS idx_specialist_comments_created_at ON specialist_comments (created_at);
CREATE INDEX IF NOT EXISTS idx_specialist_comments_deleted    ON specialist_comments (deleted_at) WHERE deleted_at IS NULL;

-- ============================================================
-- RLS 有効化
-- ============================================================
ALTER TABLE specialist_cases    ENABLE ROW LEVEL SECURITY;
ALTER TABLE deficiency_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE specialist_comments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- specialist_cases ポリシー
-- ============================================================

-- 内部ユーザー: 自社案件の specialist_cases を参照可
CREATE POLICY specialist_cases_select_internal ON specialist_cases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = specialist_cases.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- 社労士: 自分に割り当てられた有効な specialist_cases のみ参照可
CREATE POLICY specialist_cases_select_specialist ON specialist_cases
  FOR SELECT TO authenticated
  USING (
    specialist_user_id = auth.uid()
    AND is_active = TRUE
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code = 'external_specialist'
        AND up.deleted_at IS NULL
    )
  );

-- 内部ユーザー（ops系）: 社労士共有設定の作成
CREATE POLICY specialist_cases_insert_internal ON specialist_cases
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = specialist_cases.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- 内部ユーザー（ops系）: is_active 切り替え（共有の有効/無効）
CREATE POLICY specialist_cases_update_internal ON specialist_cases
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = specialist_cases.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- deficiency_requests ポリシー
-- ============================================================

-- 内部ユーザー: 自社案件の不備依頼を参照可
CREATE POLICY deficiency_select_internal ON deficiency_requests
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = deficiency_requests.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- 社労士: 担当案件の不備依頼のみ参照可
CREATE POLICY deficiency_select_specialist ON deficiency_requests
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND auth_is_specialist_for_case(case_id)
  );

-- 社労士: 不備依頼の作成（労働局指摘を入力）
CREATE POLICY deficiency_insert_specialist ON deficiency_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND auth_is_specialist_for_case(case_id)
  );

-- 社労士: 担当案件の不備依頼を更新（responded への遷移等）
CREATE POLICY deficiency_update_specialist ON deficiency_requests
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND auth_is_specialist_for_case(case_id)
  );

-- 内部ユーザー（ops系）: 不備依頼の更新（resolved 等）
CREATE POLICY deficiency_update_internal ON deficiency_requests
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = deficiency_requests.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- ============================================================
-- specialist_comments ポリシー
-- ============================================================

-- 内部ユーザー: 自社案件のコメント参照可
CREATE POLICY specialist_comments_select_internal ON specialist_comments
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = specialist_comments.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- 社労士: 担当案件のコメントのみ参照可（他事務所案件は完全不可視）
CREATE POLICY specialist_comments_select_specialist ON specialist_comments
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND auth_is_specialist_for_case(case_id)
  );

-- 内部ユーザー（ops系）: コメント投稿（is_from_specialist = FALSE を強制）
CREATE POLICY specialist_comments_insert_internal ON specialist_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND is_from_specialist = FALSE
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = specialist_comments.case_id
        AND c.deleted_at IS NULL
        AND auth_can_access_company(c.operating_company_id)
    )
  );

-- 社労士: コメント投稿（is_from_specialist = TRUE を強制）
CREATE POLICY specialist_comments_insert_specialist ON specialist_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND is_from_specialist = TRUE
    AND auth_is_specialist_for_case(case_id)
  );

-- 自分のコメントの論理削除（author_id 一致のみ）
CREATE POLICY specialist_comments_update_own ON specialist_comments
  FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    AND deleted_at IS NULL
  );

-- admin: モデレーション目的での論理削除
CREATE POLICY specialist_comments_update_admin ON specialist_comments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code = 'admin'
        AND up.deleted_at IS NULL
    )
  );

-- ============================================================
-- 既存 application_packages 社労士ポリシーを厳格化
-- 旧: role = external_specialist かつ package_status = 'shared' → 全案件参照可
-- 新: specialist_cases で紐付いている案件のみ参照可
-- ============================================================
DROP POLICY IF EXISTS app_packages_select_specialist  ON application_packages;
DROP POLICY IF EXISTS app_pkg_items_select_specialist ON application_package_items;

CREATE POLICY app_packages_select_specialist ON application_packages
  FOR SELECT TO authenticated
  USING (
    package_status = 'shared'
    AND auth_is_specialist_for_case(case_id)
  );

CREATE POLICY app_pkg_items_select_specialist ON application_package_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM application_packages ap
      WHERE ap.id = application_package_items.package_id
        AND ap.package_status = 'shared'
        AND auth_is_specialist_for_case(ap.case_id)
    )
  );
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
-- ============================================================
-- Migration: cases SELECT ポリシーを「自社案件のみ」に補正
-- 作成日:   2026-04-20
-- 背景:     20260419000007_rls_operating_company.sql では
--           Operations Staff / Sales / Accounting に対して
--           owner / case_assignments 条件まで課していたため、
--           指示書④「自社案件のみ閲覧可」より厳しくなっていた。
-- 方針:     一般スタッフは自社案件を閲覧可。
--           上位ロール（operating_company_id IS NULL）は両社横断可。
-- ============================================================

DROP POLICY IF EXISTS cases_select_company ON cases;

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

COMMENT ON POLICY cases_select_company ON cases
  IS '内部ユーザーは自社案件のみ閲覧可。operating_company_id IS NULL の上位ロールは両社横断可。';
