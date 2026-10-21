SET NOCOUNT ON;
SELECT id, 物料编码, 物料名称, 批次号, 数量, 计量单位, 检验状态, 是否合格, 检验单号, 检验数据记录单号
FROM qc_catalog_detail WHERE id>48 OR 检验单号 LIKE 'IJ-2026-10-%' ORDER BY id;
GO
SELECT id, 单据编号, 单据日期, 物料编码, 物料名称, 物料批次, 来料数量, 计量单位, 来料检验单号, asp_time1
FROM qc_insp_rec
WHERE ISNULL(来料检验单号,'')='' OR 来料检验单号 NOT IN (SELECT 单据编号 FROM qc_insp WHERE ISNULL(asp_cancel,'N')<>'Y')
   OR 单据编号 IN (SELECT 单据编号 FROM qc_insp_rec GROUP BY 单据编号 HAVING COUNT(*)>1)
ORDER BY 单据编号;
