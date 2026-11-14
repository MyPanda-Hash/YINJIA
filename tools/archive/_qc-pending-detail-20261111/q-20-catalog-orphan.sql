SET NOCOUNT ON;
PRINT N'=== A. 检验状态为空 / 检验单号为空的目录行 ===';
SELECT c.id, c.单据编号, c.检测物料类别, c.物料名称, c.物料编码, c.批次号, c.数量,
       ISNULL(c.检验状态,N'(空)') AS 检验状态, ISNULL(c.检验单号,N'(空)') AS 检验单号, c.检验数据记录单号, c.asp_time1
  FROM qc_catalog_detail c
 WHERE ISNULL(c.asp_cancel,'N')<>'Y' AND (c.检验状态 IS NULL OR ISNULL(c.检验单号,N'')=N'')
 ORDER BY c.id;

PRINT N'=== B. 这些目录行指向的记录是否存在 ===';
SELECT c.id AS 目录行id, c.检验数据记录单号,
       (SELECT COUNT(*) FROM qc_insp_rec r WHERE r.单据编号=c.检验数据记录单号 AND ISNULL(r.asp_cancel,'N')<>'Y') AS 记录是否存在
  FROM qc_catalog_detail c
 WHERE ISNULL(c.asp_cancel,'N')<>'Y' AND ISNULL(c.检验单号,N'')=N'';

PRINT N'=== C. 空壳记录(无物料、无明细、无目录行)统计 ===';
SELECT SUM(CASE WHEN ISNULL(物料名称,N'')=N'' AND ISNULL(物料编码,N'')=N'' THEN 1 ELSE 0 END) AS 无物料,
       COUNT(*) AS 无检验单号合计
  FROM qc_insp_rec r
 WHERE ISNULL(r.asp_cancel,'N')<>'Y' AND ISNULL(r.来料检验单号,N'')=N'';
