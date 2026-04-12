-- ============================================================
-- Seed: 書類要件テンプレート（助成金種別 × 書類種別）
-- 対応: FIX_INSTRUCTIONS.md C-1
-- ============================================================
-- subsidy_program_id = NULL は全助成金種別共通を意味する。
-- scope = 'company'    : 案件作成時に document_requirements に展開
-- scope = 'participant': 受講者追加時に document_requirements に展開
-- ============================================================

-- ------------------------------------------------------------
-- 全助成金種別共通 — 会社書類
-- ------------------------------------------------------------
INSERT INTO document_requirement_templates
  (subsidy_program_id, document_type_id, scope, required_flag, sort_order)
SELECT
  NULL,
  dt.id,
  'company',
  TRUE,
  dt.sort_order
FROM document_types dt
WHERE dt.code IN (
  'employment_insurance_establishment',
  'corporate_registry',
  'work_regulations',
  'application_form',
  'training_plan'
)
  AND dt.active = TRUE
ON CONFLICT (subsidy_program_id, document_type_id) DO NOTHING;

-- ------------------------------------------------------------
-- 全助成金種別共通 — 受講者書類
-- ------------------------------------------------------------
INSERT INTO document_requirement_templates
  (subsidy_program_id, document_type_id, scope, required_flag, sort_order)
SELECT
  NULL,
  dt.id,
  'participant',
  TRUE,
  dt.sort_order
FROM document_types dt
WHERE dt.code IN (
  'employment_insurance_card',
  'employment_contract',
  'attendance_record',
  'completion_certificate',
  'survey_response'
)
  AND dt.active = TRUE
ON CONFLICT (subsidy_program_id, document_type_id) DO NOTHING;
