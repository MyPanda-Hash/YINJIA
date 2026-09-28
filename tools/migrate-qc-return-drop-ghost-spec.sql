-- migrate-qc-return-drop-ghost-spec.sql — 暂收退料单明细幽灵字段清理(2026-09-23)
-- 背景:qc_return_detail 表的规格列实为 [型号](2026-09-14 重建口径,旧库 dh 证伪遗留);
--   yj_field 却多登记了一行 明细.规格型号 → getFormDescriptor 明细 SELECT 报「Invalid column name '规格型号'」,
--   暂收退料单表单 500(打印退货单取数同被阻断)。已核对 panel 全字段,幽灵仅此一行。
-- 处置:删该字段行(带列存在性守卫,幂等;规格型号 词条为多面板共享,不动 yj_translation)。
-- 对照:孤儿字段清理谓词见 tools/prune-orphan-fields.sql(detail 字段须行表列)。
SET NOCOUNT ON;

DELETE FROM yj_field
WHERE panel_code = 'QC_RETURN' AND col_name = N'规格型号'
  AND place LIKE '%detail%'
  AND COL_LENGTH('qc_return_detail', N'规格型号') IS NULL;

SELECT N'QC_RETURN明细规格型号残留' AS 检查,
       COUNT(*) AS n
FROM yj_field
WHERE panel_code = 'QC_RETURN' AND col_name = N'规格型号' AND place LIKE '%detail%';
PRINT N'migrate-qc-return-drop-ghost-spec 完成';
GO
