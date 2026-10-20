SELECT TOP 30 期间, ISNULL(批号,N'(空)') AS 批号, 期初数量, 入库数量, 出库数量, 结存数量
FROM bl_stock_close WHERE 物料编码 = N'YJ-SX-003-2' AND 仓库编码 = N'YCL-01' AND 期间 = '2026-09'
ORDER BY 批号
GO
SELECT TOP 30 ISNULL(批号,N'(空)') AS 结转批号, 数量, CONVERT(nvarchar(10), 单据日期, 120) AS 日期
FROM inh WHERE 单据类型 = N'月结结转' AND 单据编号 = 'JZ-202609'
  AND ISNULL(RTRIM(物料编码),N'') = N'YJ-SX-003-2' AND ISNULL(RTRIM(仓库编码),N'') = N'YCL-01'
GO
SELECT COUNT(*) AS JZ行数总 , COUNT(DISTINCT CONCAT(物料编码,'|',仓库编码,'|',ISNULL(批号,''))) AS JZ批号数
FROM inh WHERE 单据类型 = N'月结结转' AND ISNULL(asp_cancel,'N') <> 'Y'
GO
SELECT COUNT(*) AS 月结行表行数 FROM bl_stock_close WHERE 期间 = '2026-09' AND ISNULL(asp_cancel,'N') <> 'Y'
GO
SELECT TOP 5 物料编码, 仓库编码, ISNULL(批号,N'(空)') AS 批号, 期初数量, 入库数量, 出库数量, 结存数量
FROM bl_stock_close WHERE 期间 = '2026-09' AND 结存数量 = 0 AND ISNULL(asp_cancel,'N') <> 'Y'
GO
/* 结转行 与 月结行表 的差异:哪些 (物料,仓库,批号) 在行表里有、却没写进 inh 结转行 */
SELECT COUNT(*) AS 行表有但无结转行 FROM bl_stock_close c
WHERE c.期间 = '2026-09' AND ISNULL(c.asp_cancel,'N') <> 'Y' AND c.结存数量 <> 0
  AND NOT EXISTS (SELECT 1 FROM inh i WHERE i.单据类型 = N'月结结转' AND ISNULL(i.asp_cancel,'N') <> 'Y'
      AND ISNULL(RTRIM(i.物料编码),N'') = ISNULL(RTRIM(c.物料编码),N'')
      AND ISNULL(RTRIM(i.仓库编码),N'') = ISNULL(RTRIM(c.仓库编码),N'')
      AND ISNULL(RTRIM(i.批号),N'') = ISNULL(RTRIM(c.批号),N''))
GO
SELECT TOP 5 物料编码, 仓库编码, ISNULL(批号,N'(空)') AS 批号, 结存数量 FROM bl_stock_close c
WHERE c.期间 = '2026-09' AND ISNULL(c.asp_cancel,'N') <> 'Y' AND c.结存数量 <> 0
  AND NOT EXISTS (SELECT 1 FROM inh i WHERE i.单据类型 = N'月结结转' AND ISNULL(i.asp_cancel,'N') <> 'Y'
      AND ISNULL(RTRIM(i.物料编码),N'') = ISNULL(RTRIM(c.物料编码),N'')
      AND ISNULL(RTRIM(i.仓库编码),N'') = ISNULL(RTRIM(c.仓库编码),N'')
      AND ISNULL(RTRIM(i.批号),N'') = ISNULL(RTRIM(c.批号),N''))
