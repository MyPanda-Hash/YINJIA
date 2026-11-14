SET NOCOUNT ON;
PRINT N'=== 正式库:已完成检验的目录行 vs 明细表可见性 ===';
SELECT c.id AS 目录行id, c.物料名称, c.批次号, c.检验数据记录单号,
       (SELECT COUNT(*) FROM qc_insp_rec r WHERE r.单据编号 = c.检验数据记录单号 AND ISNULL(r.asp_cancel,'N')<>'Y') AS 记录存活,
       (SELECT COUNT(*) FROM v_qc_insp_rec_detail v WHERE v.检验数据记录单号 = c.检验数据记录单号) AS 视图可见
  FROM qc_catalog_detail c
 WHERE ISNULL(c.asp_cancel,'N')<>'Y' AND c.检验状态 = N'已完成检验'
 ORDER BY c.id;
