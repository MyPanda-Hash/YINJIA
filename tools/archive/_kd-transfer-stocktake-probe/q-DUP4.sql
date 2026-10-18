SET NOCOUNT ON;
PRINT '=== 重复组样例:是否同一单据不同源单/不同日期 ===';
SELECT TOP 8 单据编号, 物料编码, ISNULL(RTRIM(批号),N'') lot, 仓库编码, COUNT(*) 行数,
       COUNT(DISTINCT 单据日期) 不同日期, COUNT(DISTINCT ISNULL(源单编号,'')) 不同源单
FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y'
GROUP BY 单据编号,物料编码,ISNULL(RTRIM(批号),N''),仓库编码 HAVING COUNT(*)>1
ORDER BY COUNT(*) DESC;
PRINT '=== 这些重复组里,有多少是同一天同一源单(真重复) ===';
SELECT COUNT(*) 疑似真重复组 FROM (
  SELECT 单据编号, 物料编码, ISNULL(RTRIM(批号),N'') l, 仓库编码
  FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y'
  GROUP BY 单据编号,物料编码,ISNULL(RTRIM(批号),N''),仓库编码
  HAVING COUNT(*)>1 AND COUNT(DISTINCT 单据日期)=1) x;
