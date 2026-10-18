SET NOCOUNT ON;
PRINT '=== 重复组的时间分布(是否历史遗留) ===';
SELECT src, CAST(MIN(单据日期) AS date) 最早, CAST(MAX(单据日期) AS date) 最晚, COUNT(*) 组
FROM (SELECT src, 单据日期, 单据编号, 物料编码, 仓库编码, ISNULL(RTRIM(批号),N'') l, 数量
      FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转'
      GROUP BY src,单据日期,单据编号,物料编码,仓库编码,ISNULL(RTRIM(批号),N''),数量 HAVING COUNT(*)>1) x
GROUP BY src;
PRINT '=== 是否有金蝶拉取(YCD)/调拨/盘点的重复 ===';
SELECT COUNT(*) 调拨或盘点重复 FROM (
  SELECT 单据编号, 物料编码, 仓库编码, ISNULL(RTRIM(批号),N'') l, 数量
  FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND src IN (9,11)
  GROUP BY 单据编号,物料编码,仓库编码,ISNULL(RTRIM(批号),N''),数量 HAVING COUNT(*)>1) a;
