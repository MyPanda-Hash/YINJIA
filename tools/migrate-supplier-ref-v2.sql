-- migrate-supplier-ref-v2.sql — 供应商参照源改指供应商档案(GFDA)第二批
-- 2026-09-17 用户反馈:不止送料暂收单,暂收退料单/采购入库单的供应商点击选择也不应弹"往来单位"。
--   第一批(migrate-sl-supplier-ref.sql)已改 SL_RECV×3 + QC_INSP×2;本批补:
--   QC_RETURN 头 供应商/供应商代码 + 明细 供应商;PURCHASE_IN 头 供应商编码(头"供应商"上批已是 GFDA)。
--   口径:名称列 ref=mc(存名称);编码列 ref=dm、display=mc;编码↔名称双向联动由 REF_SYNONYMS 词条支持(代码已就绪)。
-- 幂等可重跑。
SET NOCOUNT ON;
GO
UPDATE yj_field SET ref_panel = 'GFDA', ref_field = 'dm', display_field = 'mc'
WHERE panel_code IN ('QC_RETURN', 'PURCHASE_IN') AND ref_panel = 'PARTNER'
  AND label IN (N'供应商代码', N'供应商编码') AND place LIKE '%header%';

UPDATE yj_field SET ref_panel = 'GFDA', ref_field = 'mc', display_field = 'mc'
WHERE panel_code = 'QC_RETURN' AND ref_panel = 'PARTNER' AND label = N'供应商';
GO
-- 自检:四面板供应商系列字段应全部 GFDA(明细 NULL 参照的 PURCHASE_IN_DETAIL 除外——本就不弹选择)
SELECT panel_code, place, label, ref_panel, ref_field, display_field FROM yj_field
WHERE panel_code IN ('SL_RECV', 'QC_INSP', 'QC_RETURN', 'PURCHASE_IN')
  AND label IN (N'供应商', N'供应商代码', N'供应商编码') AND ref_panel IS NOT NULL
ORDER BY panel_code, place;
GO
PRINT N'migrate-supplier-ref-v2 完成';
GO
