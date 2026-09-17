-- migrate-sl-supplier-ref.sql — 暂收单/检验单供应商参照源改指供应商档案(GFDA)
-- 2026-09-17 用户反馈:暂收单表格与表头的供应商选择弹出的数据来自"往来单位"(PARTNER),
--   供应商字段应从"供应商"档案(GFDA)选择。涉及 5 处字段:
--   SL_RECV 头 供应商/供应商代码 + 明细 供应商;QC_INSP 头 供应商/供应商代码。
--   口径:名称列 ref=mc(存名称,同列内既有数据与金蝶同步);编码列 ref=dm、display=mc(同 RKD/CGD 厂商代码)。
--   编码↔名称联动带回由 REF_SYNONYMS 词条(供应商编码→供应商代码/供应商名称→供应商)支持(代码已同步)。
-- 幂等可重跑。
SET NOCOUNT ON;
GO
-- SL_RECV / QC_INSP 头"供应商"(名称):改指 GFDA.mc
UPDATE yj_field SET ref_panel = 'GFDA', ref_field = 'mc', display_field = 'mc'
WHERE panel_code IN ('SL_RECV', 'QC_INSP') AND label = N'供应商' AND place LIKE '%header%'
  AND ISNULL(ref_panel, '') <> 'GFDA';

-- SL_RECV / QC_INSP 头"供应商代码"(编码):改指 GFDA.dm,显示名称
UPDATE yj_field SET ref_panel = 'GFDA', ref_field = 'dm', display_field = 'mc'
WHERE panel_code IN ('SL_RECV', 'QC_INSP') AND label = N'供应商代码' AND place LIKE '%header%'
  AND ISNULL(ref_panel, '') <> 'GFDA';

-- SL_RECV 明细"供应商"(名称):改指 GFDA.mc
UPDATE yj_field SET ref_panel = 'GFDA', ref_field = 'mc', display_field = 'mc'
WHERE panel_code = 'SL_RECV' AND label = N'供应商' AND place LIKE '%detail%'
  AND ISNULL(ref_panel, '') <> 'GFDA';
GO
-- 自检:5 行应全部 ref_panel=GFDA
SELECT panel_code, place, label, ref_panel, ref_field, display_field FROM yj_field
WHERE panel_code IN ('SL_RECV', 'QC_INSP') AND label IN (N'供应商', N'供应商代码')
ORDER BY panel_code, place;
GO
PRINT N'migrate-sl-supplier-ref 完成';
GO
