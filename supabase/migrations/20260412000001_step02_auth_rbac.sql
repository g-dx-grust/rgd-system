-- ============================================================
-- Migration: Step 2 — 認証・権限管理 RLS ポリシー追加
-- 作成日: 2026-04-12
-- Step: 2 認証・権限管理
-- ============================================================

-- ------------------------------------------------------------
-- user_profiles: admin ロールは全ユーザーを参照・更新できる
-- ------------------------------------------------------------

-- admin はすべての user_profiles を参照可
CREATE POLICY user_profiles_select_admin ON user_profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code = 'admin'
        AND up.deleted_at IS NULL
    )
  );

-- admin は user_profiles を更新可（ロール変更・無効化）
CREATE POLICY user_profiles_update_admin ON user_profiles
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

-- 自分自身の更新（display_name 等）
CREATE POLICY user_profiles_update_own ON user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- 新規プロフィール挿入（Supabase Auth トリガー経由 or 管理者）
CREATE POLICY user_profiles_insert_admin ON user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code = 'admin'
        AND up.deleted_at IS NULL
    )
  );

-- ------------------------------------------------------------
-- audit_logs: admin / operations_manager / auditor は参照可
-- ------------------------------------------------------------

CREATE POLICY audit_logs_select_privileged ON audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON r.id = up.role_id
      WHERE up.id = auth.uid()
        AND r.code IN ('admin', 'operations_manager', 'auditor')
        AND up.deleted_at IS NULL
    )
  );

-- ------------------------------------------------------------
-- ユーザープロフィール自動作成トリガー
-- Supabase Auth でアカウントが作成された後、
-- user_profiles に初期レコードを挿入する
-- (role は operations_staff をデフォルトとする)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_role_id UUID;
BEGIN
  SELECT id INTO default_role_id
  FROM roles
  WHERE code = 'operations_staff'
  LIMIT 1;

  INSERT INTO user_profiles (id, role_id, display_name, email)
  VALUES (
    NEW.id,
    default_role_id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
