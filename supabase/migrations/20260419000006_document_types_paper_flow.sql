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
