-- ============================================================
-- Migration: 0001 初期スキーマ (roles / users)
-- 作成日: 2026-04-12
-- Step: 1 基盤構築
-- ============================================================

-- ------------------------------------------------------------
-- 拡張機能
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- ロール定義テーブル
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT NOT NULL UNIQUE,   -- 内部コード (admin, operations_manager, ...)
  label_ja    TEXT NOT NULL,          -- 日本語表示名
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE roles IS 'ユーザーロール定義マスタ';

-- 初期ロールデータ
INSERT INTO roles (code, label_ja, sort_order) VALUES
  ('admin',                'システム管理者',    10),
  ('operations_manager',   '運用責任者',        20),
  ('operations_staff',     '申請事務担当',      30),
  ('sales',                '営業',              40),
  ('accounting',           '経理',              50),
  ('auditor',              '監査/閲覧専用',     60),
  ('client_portal_user',   '顧客担当者',        70),
  ('external_specialist',  '社労士等',          80)
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------
-- ユーザープロフィールテーブル
-- (Supabase Auth の auth.users と 1:1 対応)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id       UUID NOT NULL REFERENCES roles(id),
  display_name  TEXT NOT NULL,
  email         TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at    TIMESTAMPTZ,          -- 論理削除
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_profiles IS 'ユーザープロフィール (Supabase Auth連携)';

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- 監査ログテーブル
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,          -- 操作種別 (login, logout, case_create, ...)
  target_type TEXT,                   -- 対象リソース種別 (case, document, ...)
  target_id   UUID,                   -- 対象リソースID
  metadata    JSONB,                  -- 追加情報
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS '監査ログ (重要操作の記録)';

-- 監査ログは追記のみ (更新・削除禁止)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- roles: 認証済みユーザーは参照可
CREATE POLICY roles_select_authenticated ON roles
  FOR SELECT TO authenticated USING (true);

-- user_profiles: 自分自身のみ参照可 (admin は別途管理)
CREATE POLICY user_profiles_select_own ON user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- audit_logs: 挿入のみ許可（参照は admin 権限で制御）
CREATE POLICY audit_logs_insert_authenticated ON audit_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
