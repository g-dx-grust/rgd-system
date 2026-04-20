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
