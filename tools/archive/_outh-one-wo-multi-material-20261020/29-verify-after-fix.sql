SET NOCOUNT ON;
SELECT COUNT(*) AS 该单流水行, COUNT(DISTINCT rid) AS 不同rid, SUM(CASE WHEN asp_cancel='Y' THEN 1 ELSE 0 END) AS 作废行
  FROM dbo.outh WHERE src = 6 AND 单据编号 = N'SCLL-20260902-00011';
SELECT TOP 3 id, rid, 物料编码, 批号, asp_cancel AS 作废, CONVERT(varchar(19),asp_time1,120) AS 写入
  FROM dbo.outh WHERE src = 6 AND 单据编号 = N'SCLL-20260902-00011' ORDER BY id;
SELECT COUNT(*) AS 全表重复srcrid FROM (SELECT src, rid FROM dbo.outh WHERE rid IS NOT NULL GROUP BY src, rid HAVING COUNT(*) > 1) t;
