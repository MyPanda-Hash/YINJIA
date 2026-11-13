SET NOCOUNT ON;
SELECT 检验数据记录单号, 物料编码, 物料批次, ISNULL(检验状态,N'(空)') AS 检验状态, 目录单号, 目录行id
  FROM v_qc_insp_rec_detail
 WHERE 检验数据记录单号 IN (N'JYSJ-2026-09-0032', N'JYSJ-2026-09-0044', N'JYSJ-2026-09-0048');
PRINT N'=== 目录行 23 ===';
SELECT id, 物料名称, 物料编码, 批次号, 检验状态, 检验数据记录单号, 检验单号 FROM qc_catalog_detail WHERE id = 23;
PRINT N'=== 记录 JYSJ-2026-09-0048 ===';
SELECT 单据编号, 来料检验单号, 物料编码, 物料名称, 物料批次 FROM qc_insp_rec WHERE 单据编号 = N'JYSJ-2026-09-0048';
