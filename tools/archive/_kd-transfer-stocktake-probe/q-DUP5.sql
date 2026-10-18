SET NOCOUNT ON;
PRINT '=== inh 重复组:按单据日期是否唯一判断 ===';
SELECT COUNT(*) 重复组数,
       SUM(CASE WHEN 不同日期=1 THEN 1 ELSE 0 END) 同日组,
       SUM(CASE WHEN 不同日期>1 THEN 1 ELSE 0 END) 跨日组
FROM (
  SELECT 单据编号, 物料编码, ISNULL(RTRIM(批号),N'') l, 仓库编码, COUNT(DISTINCT 单据日期) 不同日期
  FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y'
  GROUP BY 单据编号,物料编码,ISNULL(RTRIM(批号),N''),仓库编码 HAVING COUNT(*)>1) x;
PRINT '=== 同日重复组 TOP5 明细(看是否真重复) ===';
SELECT TOP 5 单据编号, 物料编码, ISNULL(RTRIM(批号),N'') lot, 仓库编码, COUNT(*) n, SUM(数量) 合计, MIN(单据日期) d
FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y'
GROUP BY 单据编号,物料编码,ISNULL(RTRIM(批号),N''),仓库编码
HAVING COUNT(*)>1 AND COUNT(DISTINCT 单据日期)=1
ORDER BY COUNT(*) DESC;
