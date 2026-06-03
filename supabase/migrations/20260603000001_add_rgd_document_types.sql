-- ============================================================
-- Migration: RGD書類種別の追加・名称修正（2026-06-03 修正依頼）
--
--   1. 不足していたRGD書類6種を document_types マスタへ追加する。
--      （書類追加ドロップダウンはマスタを動的参照するため、追加のみで反映される）
--   2. 案内開始時に格納する書類の表示名を「開始案内」→「ご案内書」へ変更する。
--      code (start_guide) は変更しないため、既存データ・格納済みファイルへの
--      影響はなく、表示名のみが切り替わる。
--
--   いずれも追加・名称変更のみで、既存レコードの削除は行わない安全な変更。
--
--   scope:          company（会社単位） / participant（受講者単位） / case（案件進行）
--   reusable_level: organization / case / participant
-- ============================================================

INSERT INTO document_types (code, name, scope, reusable_level, description, sort_order) VALUES
  (
    'account_issue_sheet',
    'アカウント発行シート',
    'case', 'case',
    'システム・ポータルのアカウント発行に関するシート',
    150
  ),
  (
    'plan_notification_receipt',
    '計画届計画受付書',
    'case', 'case',
    '訓練計画届に対する計画受付書',
    160
  ),
  (
    'plan_receipt',
    '計画受付書',
    'case', 'case',
    '労働局発行の計画受付書',
    170
  ),
  (
    'dx_document',
    'DX文書',
    'case', 'case',
    'DX関連の提出書類',
    180
  ),
  (
    'power_of_attorney',
    '委任状',
    'company', 'organization',
    '申請代行等に係る委任状（会社単位で再利用）',
    70
  ),
  (
    'employment_insurance_loss',
    '雇用保険被保険者資格喪失届',
    'participant', 'participant',
    '受講者の雇用保険被保険者資格喪失届',
    390
  )
ON CONFLICT (code) DO NOTHING;

-- 「開始案内」→「ご案内書」へ表示名を変更（code は据え置き）
UPDATE document_types
SET name = 'ご案内書'
WHERE code = 'start_guide';
