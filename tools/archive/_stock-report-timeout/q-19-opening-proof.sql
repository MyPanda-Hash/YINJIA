/* q-19-opening-proof.sql — 证明「期初只进了 kucun、没进流水」(只读) */
SET NOCOUNT ON;
GO
SELECT N'kucun 来源分布' AS k, ISNULL(asp_user1, N'(空)') AS 来源, COUNT(*) AS 行数,
       CAST(SUM(yl) AS decimal(18,2)) AS 现存量合计,
       CAST(SUM(rkl) AS decimal(18,2)) AS 累计入,
       CAST(SUM(ckl) AS decimal(18,2)) AS 累计出
FROM dbo.kucun WHERE ISNULL(asp_cancel,'N') <> 'Y'
GROUP BY asp_user1 ORDER BY 行数 DESC;
GO
SELECT TOP 5 N'期初导入行样例' AS k, wzdm, ckdm, lot_no, rkl, ckl, yl, price, asp_user1
FROM dbo.kucun WHERE ISNULL(asp_cancel,'N') <> 'Y' AND asp_user1 = N'期初导入' ORDER BY yl DESC;
GO
SELECT N'样例物料的 kucun' AS k, wzdm, ckdm, lot_no, rkl, ckl, yl, asp_user1
FROM dbo.kucun WHERE wzdm IN (N'YJ-AJ-016-2', N'YJ-SX-001-2') AND ISNULL(asp_cancel,'N') <> 'Y';
GO
SELECT N'样例物料的流水' AS k, src, 单据类型, 单据编号, 仓库编码, 批号, 净数量, 单据日期
FROM (SELECT src, 单据类型, 单据编号, 仓库编码, 批号, 数量 AS 净数量, 单据日期 FROM dbo.inh
        WHERE 物料编码 = N'YJ-AJ-016-2' AND ISNULL(asp_cancel,'N')<>'Y'
      UNION ALL
      SELECT src, 单据类型, 单据编号, 仓库编码, 批号, -数量, 单据日期 FROM dbo.outh
        WHERE 物料编码 = N'YJ-AJ-016-2' AND ISNULL(asp_cancel,'N')<>'Y') x
ORDER BY 单据日期, src;
GO
