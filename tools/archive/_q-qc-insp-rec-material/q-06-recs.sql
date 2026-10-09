-- q-06-recs.sql — 探针:检验数据记录里两列的填报错位情况
SELECT id, 单据编号, 物料名称, 物料编码, 物料批次 FROM qc_insp_rec ORDER BY id DESC;

PRINT N'=== 错位统计 ===';
SELECT
  SUM(CASE WHEN ISNULL(物料名称,N'')<>N'' AND ISNULL(物料编码,N'')=N'' THEN 1 ELSE 0 END) AS 有名称无编码,
  SUM(CASE WHEN ISNULL(物料名称,N'')=N'' AND ISNULL(物料编码,N'')<>N'' THEN 1 ELSE 0 END) AS 有编码无名称,
  SUM(CASE WHEN ISNULL(物料名称,N'')<>N'' AND ISNULL(物料编码,N'')<>N'' THEN 1 ELSE 0 END) AS 两者都有,
  SUM(CASE WHEN ISNULL(物料名称,N'')=N'' AND ISNULL(物料编码,N'')=N'' THEN 1 ELSE 0 END) AS 两者都空
FROM qc_insp_rec;

PRINT N'=== 检验目录里的目录行(物料编码来源) ===';
SELECT TOP 10 id, 物料编码, 物料名称, 检验状态, 检验单号, 检验数据记录单号 FROM qc_catalog_detail WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
