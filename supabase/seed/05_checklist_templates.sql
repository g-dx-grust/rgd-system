-- ============================================================
-- Seed: チェックリストテンプレート（初回申請・最終申請）
-- 対応: FIX_INSTRUCTIONS.md C-1
-- ============================================================
-- 全助成金種別共通のチェックリストテンプレートを投入する。
-- subsidy_program_id = NULL は全種別共通を意味する。
-- ============================================================

-- ------------------------------------------------------------
-- チェックリストテンプレート（フェーズ定義）
-- ------------------------------------------------------------
INSERT INTO checklist_templates (code, name, phase, subsidy_program_id, sort_order) VALUES
  ('pre_application_common',   '初回申請チェックリスト（共通）',   'pre_application',   NULL, 10),
  ('final_application_common', '最終申請チェックリスト（共通）',   'final_application', NULL, 20)
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------
-- 初回申請チェックリスト項目
-- ------------------------------------------------------------
INSERT INTO checklist_template_items (template_id, label, required, sort_order)
SELECT
  t.id,
  items.label,
  items.required,
  items.sort_order
FROM checklist_templates t
CROSS JOIN (VALUES
  ('雇用保険適用事業所設置届（控え）が登録済み',               TRUE,  10),
  ('謄本（履歴事項全部証明書・3ヶ月以内取得）が登録済み',      TRUE,  20),
  ('就業規則が登録済み',                                        TRUE,  30),
  ('訓練計画書が確定・登録済み',                                TRUE,  40),
  ('全受講者の雇用保険被保険者証が登録済み',                    TRUE,  50),
  ('全受講者の雇用契約書が登録済み',                            TRUE,  60),
  ('申込書に記名・押印済み',                                    TRUE,  70),
  ('担当社労士への連携パッケージが生成済み',                    FALSE, 80)
) AS items(label, required, sort_order)
WHERE t.code = 'pre_application_common'
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- 最終申請チェックリスト項目
-- ------------------------------------------------------------
INSERT INTO checklist_template_items (template_id, label, required, sort_order)
SELECT
  t.id,
  items.label,
  items.required,
  items.sort_order
FROM checklist_templates t
CROSS JOIN (VALUES
  ('全受講者の視聴ログが基準時間を満たす',                      TRUE,  10),
  ('全受講者のアンケート回答が回収済み',                        TRUE,  20),
  ('修了証が全員分登録済み',                                    TRUE,  30),
  ('出勤記録・タイムカードが全研修期間分登録済み',               TRUE,  40),
  ('請求書・証憑が全て登録済み',                                TRUE,  50),
  ('最終申請パッケージが生成済み',                              TRUE,  60),
  ('視聴ログ最終確認が完了済み',                                TRUE,  70)
) AS items(label, required, sort_order)
WHERE t.code = 'final_application_common'
ON CONFLICT DO NOTHING;
