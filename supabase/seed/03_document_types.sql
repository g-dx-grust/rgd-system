-- ============================================================
-- Seed: 書類種別マスタ（完全版）
-- Step: 10 本番化・移行・運用開始
-- ============================================================
-- scope: company（会社単位）/ participant（受講者単位）/ case（案件進行）
-- reusable_level: organization（企業で再利用）/ case（案件ごと）/ participant（受講者ごと）

INSERT INTO document_types (code, name, scope, reusable_level, sort_order, active) VALUES
  -- ============================================================
  -- 会社単位書類（scope = company）
  -- ============================================================
  (
    'employment_insurance_establishment',
    '雇用保険適用事業所設置届（控え）',
    'company', 'organization', 10, TRUE
  ),
  (
    'corporate_registry',
    '謄本（履歴事項全部証明書）',
    'company', 'organization', 20, TRUE
  ),
  (
    'work_regulations',
    '就業規則',
    'company', 'organization', 30, TRUE
  ),
  (
    'officer_list',
    '役員情報',
    'company', 'organization', 40, TRUE
  ),
  (
    'salary_ledger',
    '賃金台帳',
    'company', 'organization', 50, TRUE
  ),
  (
    'attendance_management_rules',
    '労働時間管理規程',
    'company', 'organization', 60, TRUE
  ),
  -- ============================================================
  -- 案件単位書類（scope = case）
  -- ============================================================
  (
    'application_form',
    '申込書',
    'case', 'case', 110, TRUE
  ),
  (
    'training_plan',
    '訓練計画書',
    'case', 'case', 120, TRUE
  ),
  (
    'training_schedule',
    '訓練実施スケジュール',
    'case', 'case', 130, TRUE
  ),
  (
    'pre_application_checklist',
    '初回申請チェックリスト',
    'case', 'case', 140, TRUE
  ),
  (
    'start_guide',
    '開始案内',
    'case', 'case', 210, TRUE
  ),
  (
    'invoice',
    '請求書',
    'case', 'case', 220, TRUE
  ),
  (
    'evidence',
    '証憑',
    'case', 'case', 230, TRUE
  ),
  (
    'viewing_log',
    '視聴ログ',
    'case', 'case', 240, TRUE
  ),
  (
    'specialist_package',
    '社労士連携パッケージ',
    'case', 'case', 250, TRUE
  ),
  (
    'final_application_checklist',
    '最終申請チェックリスト',
    'case', 'case', 260, TRUE
  ),
  -- ============================================================
  -- 受講者単位書類（scope = participant）
  -- ============================================================
  (
    'employment_insurance_card',
    '雇用保険被保険者証',
    'participant', 'participant', 310, TRUE
  ),
  (
    'employment_contract',
    '雇用契約書',
    'participant', 'participant', 320, TRUE
  ),
  (
    'identity_document',
    '本人確認書類',
    'participant', 'participant', 330, TRUE
  ),
  (
    'attendance_record',
    '出勤記録・タイムカード',
    'participant', 'participant', 340, TRUE
  ),
  (
    'completion_certificate',
    '修了証',
    'participant', 'participant', 350, TRUE
  ),
  (
    'survey_response',
    'アンケート回答',
    'participant', 'participant', 360, TRUE
  ),
  (
    'skill_check_pre',
    '訓練前スキルチェック',
    'participant', 'participant', 370, TRUE
  ),
  (
    'skill_check_post',
    '訓練後スキルチェック',
    'participant', 'participant', 380, TRUE
  ),
  -- ============================================================
  -- 汎用
  -- ============================================================
  (
    'other',
    'その他',
    'case', 'case', 999, TRUE
  )
ON CONFLICT (code) DO UPDATE
  SET
    name           = EXCLUDED.name,
    scope          = EXCLUDED.scope,
    reusable_level = EXCLUDED.reusable_level,
    sort_order     = EXCLUDED.sort_order,
    active         = EXCLUDED.active,
    updated_at     = NOW();
