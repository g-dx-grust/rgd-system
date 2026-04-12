-- ============================================================
-- Migration: Step 4 — 書類回収・ファイル管理
-- 作成日: 2026-04-12
-- Step: 4 書類回収・ファイル管理
-- ============================================================

-- ------------------------------------------------------------
-- 書類種別マスタ
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_types (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  scope           TEXT NOT NULL DEFAULT 'company',   -- company / participant / case
  reusable_level  TEXT NOT NULL DEFAULT 'case',      -- organization / case / participant
  description     TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT document_types_scope_check CHECK (
    scope IN ('company', 'participant', 'case')
  ),
  CONSTRAINT document_types_reusable_level_check CHECK (
    reusable_level IN ('organization', 'case', 'participant')
  )
);

COMMENT ON TABLE document_types IS '書類種別マスタ';

CREATE TRIGGER document_types_updated_at
  BEFORE UPDATE ON document_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 代表的な書類種別シードデータ
INSERT INTO document_types (code, name, scope, reusable_level, sort_order) VALUES
  -- 会社単位
  ('employment_insurance_establishment',  '雇用保険適用事業所設置届（控え）', 'company', 'organization', 10),
  ('corporate_registry',                  '謄本（履歴事項全部証明書）',        'company', 'organization', 20),
  ('work_regulations',                    '就業規則',                          'company', 'organization', 30),
  ('officer_list',                        '役員情報',                          'company', 'organization', 40),
  ('application_form',                    '申込書',                            'case',    'case',         50),
  ('training_plan',                       '訓練計画書',                        'case',    'case',         60),
  -- 受講者単位
  ('employment_insurance_card',           '雇用保険被保険者証',                'participant', 'participant', 110),
  ('employment_contract',                 '雇用契約書',                        'participant', 'participant', 120),
  ('identity_document',                   '本人確認書類',                      'participant', 'participant', 130),
  ('attendance_record',                   '出勤記録・タイムカード',            'participant', 'participant', 140),
  ('completion_certificate',              '修了証',                            'participant', 'participant', 150),
  ('survey_response',                     'アンケート回答',                    'participant', 'participant', 160),
  -- 案件進行
  ('start_guide',                         '開始案内',                          'case', 'case', 210),
  ('invoice',                             '請求書',                            'case', 'case', 220),
  ('evidence',                            '証憑',                              'case', 'case', 230),
  ('viewing_log',                         '視聴ログ',                          'case', 'case', 240),
  ('specialist_package',                  '社労士連携パッケージ',              'case', 'case', 250),
  ('other',                               'その他',                            'case', 'case', 999)
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------
-- 案件ごとの必要書類要件
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_requirements (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id             UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  participant_id      UUID REFERENCES participants(id) ON DELETE CASCADE,
  document_type_id    UUID NOT NULL REFERENCES document_types(id),
  required_flag       BOOLEAN NOT NULL DEFAULT TRUE,
  due_date            DATE,
  status              TEXT NOT NULL DEFAULT 'pending',
  requested_at        TIMESTAMPTZ,
  approved_at         TIMESTAMPTZ,
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT document_requirements_status_check CHECK (
    status IN ('pending', 'received', 'returned', 'approved')
  )
);

COMMENT ON TABLE document_requirements IS '案件ごとの必要書類要件';

CREATE TRIGGER document_requirements_updated_at
  BEFORE UPDATE ON document_requirements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_doc_req_case_id           ON document_requirements (case_id);
CREATE INDEX IF NOT EXISTS idx_doc_req_participant_id    ON document_requirements (participant_id);
CREATE INDEX IF NOT EXISTS idx_doc_req_document_type_id  ON document_requirements (document_type_id);
CREATE INDEX IF NOT EXISTS idx_doc_req_status            ON document_requirements (status);
CREATE INDEX IF NOT EXISTS idx_doc_req_due_date          ON document_requirements (due_date);

-- ------------------------------------------------------------
-- 実ファイルメタデータ
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id                 UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  participant_id          UUID REFERENCES participants(id) ON DELETE SET NULL,
  document_requirement_id UUID REFERENCES document_requirements(id) ON DELETE SET NULL,
  document_type_id        UUID NOT NULL REFERENCES document_types(id),
  storage_bucket          TEXT NOT NULL DEFAULT 'case-documents',
  storage_path            TEXT NOT NULL,
  original_filename       TEXT NOT NULL,
  mime_type               TEXT NOT NULL,
  file_size               BIGINT NOT NULL,
  version_no              INTEGER NOT NULL DEFAULT 1,
  replaced_document_id    UUID REFERENCES documents(id) ON DELETE SET NULL,
  review_status           TEXT NOT NULL DEFAULT 'uploaded',
  return_reason           TEXT,           -- 差戻し理由コード
  return_reason_detail    TEXT,           -- 差戻し理由詳細（顧客向けに表示可）
  internal_memo           TEXT,           -- 内部メモ（顧客向けには非表示）
  uploaded_by_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT documents_review_status_check CHECK (
    review_status IN ('uploaded', 'reviewing', 'returned', 'approved')
  ),
  CONSTRAINT documents_return_reason_check CHECK (
    return_reason IN (
      'unclear_image',
      'missing_pages',
      'wrong_subject',
      'wrong_type',
      'insufficient_content',
      'expired',
      'other',
      NULL
    )
  )
);

COMMENT ON TABLE documents IS '実ファイルメタデータ（版管理含む）';

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_documents_case_id              ON documents (case_id);
CREATE INDEX IF NOT EXISTS idx_documents_organization_id      ON documents (organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_participant_id       ON documents (participant_id);
CREATE INDEX IF NOT EXISTS idx_documents_document_type_id    ON documents (document_type_id);
CREATE INDEX IF NOT EXISTS idx_documents_review_status       ON documents (review_status);
CREATE INDEX IF NOT EXISTS idx_documents_requirement_id      ON documents (document_requirement_id);
CREATE INDEX IF NOT EXISTS idx_documents_replaced_doc_id     ON documents (replaced_document_id);
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at          ON documents (deleted_at);

-- ------------------------------------------------------------
-- 顧客向けアップロードトークン
-- (外部提出画面 /upload/[token] で使用)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS upload_tokens (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token              TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  case_id            UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at         TIMESTAMPTZ NOT NULL,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  note               TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE upload_tokens IS '顧客向け書類提出リンクトークン';

CREATE INDEX IF NOT EXISTS idx_upload_tokens_token     ON upload_tokens (token);
CREATE INDEX IF NOT EXISTS idx_upload_tokens_case_id   ON upload_tokens (case_id);
CREATE INDEX IF NOT EXISTS idx_upload_tokens_expires_at ON upload_tokens (expires_at);

-- ------------------------------------------------------------
-- 集計ビュー: 案件ごとの書類進捗サマリー
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW case_document_summary AS
SELECT
  c.id                                             AS case_id,
  COUNT(dr.id)                                     AS total_requirements,
  COUNT(dr.id) FILTER (WHERE dr.required_flag)     AS required_count,
  COUNT(dr.id) FILTER (WHERE dr.status = 'approved')   AS approved_count,
  COUNT(dr.id) FILTER (WHERE dr.status = 'received')   AS received_count,
  COUNT(dr.id) FILTER (WHERE dr.status = 'returned')   AS returned_count,
  COUNT(dr.id) FILTER (WHERE dr.status = 'pending' AND dr.required_flag)  AS pending_required_count,
  COUNT(dr.id) FILTER (
    WHERE dr.required_flag
      AND dr.status NOT IN ('approved', 'received')
  )                                                AS insufficient_count
FROM cases c
LEFT JOIN document_requirements dr ON dr.case_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id;

COMMENT ON VIEW case_document_summary IS '案件ごとの書類充足率サマリー';

-- 受講者ごとのサマリー
CREATE OR REPLACE VIEW participant_document_summary AS
SELECT
  p.id                                             AS participant_id,
  p.case_id,
  COUNT(dr.id)                                     AS total_requirements,
  COUNT(dr.id) FILTER (WHERE dr.required_flag)     AS required_count,
  COUNT(dr.id) FILTER (WHERE dr.status = 'approved')   AS approved_count,
  COUNT(dr.id) FILTER (WHERE dr.status = 'returned')   AS returned_count,
  COUNT(dr.id) FILTER (
    WHERE dr.required_flag
      AND dr.status NOT IN ('approved', 'received')
  )                                                AS insufficient_count
FROM participants p
LEFT JOIN document_requirements dr ON dr.participant_id = p.id
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.case_id;

COMMENT ON VIEW participant_document_summary IS '受講者ごとの書類充足率サマリー';

-- ------------------------------------------------------------
-- Storage バケット（supabase SQL管理）
-- 実際のバケット作成は Supabase Dashboard または CLI で行う:
--   supabase storage create case-documents --public=false
-- 以下は storage スキーマが利用可能な場合のポリシー設定
-- ------------------------------------------------------------

-- バケット作成（storage スキーマが存在する場合）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'case-documents',
  'case-documents',
  FALSE,
  104857600,  -- 100MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage ポリシー: 内部ユーザーはアップロード可（サービスロールキーで操作が基本）
CREATE POLICY "case_documents_upload_internal"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'case-documents'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('external_specialist')
        AND up.deleted_at IS NULL
    )
  );

-- Storage ポリシー: 内部ユーザーは参照可（署名付きURL発行はサーバー経由）
CREATE POLICY "case_documents_select_internal"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'case-documents'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );

-- ------------------------------------------------------------
-- Row Level Security (documents / document_requirements)
-- ------------------------------------------------------------
ALTER TABLE document_types          ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_requirements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_tokens           ENABLE ROW LEVEL SECURITY;

-- 書類種別: 認証済み全ユーザー参照可
CREATE POLICY document_types_select ON document_types
  FOR SELECT TO authenticated USING (active = TRUE);

-- 書類要件: 内部ユーザー参照
CREATE POLICY doc_req_select_internal ON document_requirements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );

-- 書類要件: 内部ユーザー挿入・更新
CREATE POLICY doc_req_insert_internal ON document_requirements
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
  );

CREATE POLICY doc_req_update_internal ON document_requirements
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
  );

-- 書類ファイル: 内部ユーザー参照（論理削除済み除く）
CREATE POLICY documents_select_internal ON documents
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
  );

-- 書類ファイル: 内部ユーザー挿入
CREATE POLICY documents_insert_internal ON documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );

-- 書類ファイル: 内部ユーザー更新（レビューステータス変更等）
CREATE POLICY documents_update_internal ON documents
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
  );

-- アップロードトークン: 内部ユーザー操作
CREATE POLICY upload_tokens_select_internal ON upload_tokens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code NOT IN ('client_portal_user', 'external_specialist')
        AND up.deleted_at IS NULL
    )
  );

CREATE POLICY upload_tokens_insert_internal ON upload_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'operations_staff')
        AND up.deleted_at IS NULL
    )
  );
