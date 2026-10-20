SELECT TOP 20 src, rid, 单据编号, 单据类型, 单据日期, '[' + 物料编码 + ']' AS 物料, '[' + 仓库编码 + ']' AS 仓库, '[' + 批号 + ']' AS 批号, 数量
FROM inh WHERE 批号 LIKE N'%XC-20260908%'
ORDER BY 单据日期
GO
SELECT TOP 10 '[' + 物料编码 + ']' AS 物料, '[' + 仓库编码 + ']' AS 仓库, COUNT(*) AS 行数
FROM inh WHERE ISNULL(asp_cancel,'N') <> 'Y' GROUP BY 物料编码, 仓库编码 ORDER BY 行数 DESC
GO
SELECT TOP 5 ISNULL(物料编码,N'(null)') AS m, ISNULL(仓库编码,N'(null)') AS w, 批号, 单据类型, 单据日期, 数量 FROM inh WHERE 单据类型 = N'月结结转' ORDER BY 单据日期 DESC
