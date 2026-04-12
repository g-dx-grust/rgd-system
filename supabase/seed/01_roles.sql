-- ============================================================
-- Seed: 初期ロールデータ
-- Step: 1 基盤構築
-- ============================================================
-- migration の INSERT と重複しないよう ON CONFLICT DO NOTHING を使用
-- ローカル開発・本番共通で適用可能

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
