-- ============================================================
-- Seed: 助成金種別マスタ
-- Step: 10 本番化・移行・運用開始
-- ============================================================
-- 既存 migration の INSERT と重複しないよう ON CONFLICT DO UPDATE を使用
-- 本番・ステージング・ローカル共通で適用可能

INSERT INTO subsidy_programs (code, name, description, sort_order, active) VALUES
  (
    'jinzai_kaihatsu',
    '人材開発支援助成金（特定訓練コース）',
    'OJT と Off-JT を組み合わせた正規雇用労働者向けの訓練コース。高度デジタル人材育成などが対象。',
    10,
    TRUE
  ),
  (
    'jinzai_kaihatsu_ippan',
    '人材開発支援助成金（一般訓練コース）',
    'Off-JT による訓練で、特定訓練コース以外の職業訓練を行う場合に利用できるコース。',
    20,
    TRUE
  ),
  (
    'jinzai_kaihatsu_jigyonushi',
    '人材開発支援助成金（事業展開等リスキリング支援コース）',
    '新規事業立ち上げ等に伴うリスキリングを支援するコース。',
    30,
    TRUE
  ),
  (
    'kyoiku_kunren_tokutei',
    '教育訓練給付（特定一般教育訓練）',
    '速やかな再就職・早期のキャリア形成に資する教育訓練が対象。受講費用の40%を給付。',
    40,
    TRUE
  ),
  (
    'kyoiku_kunren_senmon',
    '教育訓練給付（専門実践教育訓練）',
    '中長期的なキャリア形成に資する専門的・実践的な教育訓練が対象。受講費用の50〜70%を給付。',
    50,
    TRUE
  ),
  (
    'other',
    'その他',
    '上記以外の助成金・補助金スキームを利用する案件。',
    99,
    TRUE
  )
ON CONFLICT (code) DO UPDATE
  SET
    name        = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order  = EXCLUDED.sort_order,
    active      = EXCLUDED.active,
    updated_at  = NOW();
