SET NOCOUNT ON;
/* 补齐结果取证：31 张被补的产成品入库单 + 对应工单信息 + 入库产品，便于人工复核 */
SELECT h.单据编号, h.单据日期, h.加工单号, h.工单行号,
       p.pl_date AS 工单日期, DATEDIFF(day, CAST(p.pl_date AS date), CAST(h.单据日期 AS date)) AS 入库_工单_相差天,
       (SELECT COUNT(*) FROM dbo.plang p2 WHERE p2.pl_no = h.加工单号) AS 工单行总数,
       (SELECT STUFF((SELECT DISTINCT N',' + y.产品编码 FROM dbo.bl_finish_in y
                       WHERE y.单据编号 = h.单据编号 FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, N'')) AS 入库产品,
       (SELECT STUFF((SELECT N',' + CONVERT(nvarchar(10), p3.pl_xc) + N':' + p3.dm FROM dbo.plang p3
                       WHERE p3.pl_no = h.加工单号 FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, N'')) AS 工单行明细,
       (SELECT MAX(l.实收数量) FROM dbo.bl_finish_in l WHERE l.单据编号 = h.单据编号) AS 最大实收数量
  FROM dbo.bd_finish_in h
  LEFT JOIN dbo.plang p ON p.pl_no = h.加工单号 AND p.pl_xc = ISNULL(h.工单行号, p.pl_xc)
 WHERE ISNULL(h.加工单号, N'') <> N''
 ORDER BY h.单据编号;
GO
SELECT '=== 按工单号汇总(一张工单被几张入库单补上) ===' AS s;
SELECT h.加工单号, COUNT(*) AS 入库单数, MIN(h.单据日期) AS 最早, MAX(h.单据日期) AS 最晚
  FROM dbo.bd_finish_in h WHERE ISNULL(h.加工单号, N'') <> N''
 GROUP BY h.加工单号 ORDER BY h.加工单号;
GO
SELECT '=== 仍为空的 200 张：按原因分类 ===' AS s;
WITH e AS (
  SELECT h.单据编号,
         COUNT(DISTINCT RTRIM(LTRIM(l.产品编码))) AS 产品数,
         (SELECT COUNT(DISTINCT p.pl_no) FROM dbo.plang p
           WHERE CAST(p.pl_date AS date) <= h.单据日期
             AND EXISTS (SELECT 1 FROM dbo.bl_finish_in l2
                          WHERE l2.单据编号 = h.单据编号
                            AND RTRIM(LTRIM(l2.产品编码)) = RTRIM(LTRIM(p.dm)))) AS 相关工单数
    FROM dbo.bd_finish_in h JOIN dbo.bl_finish_in l ON l.单据编号 = h.单据编号
   WHERE ISNULL(h.加工单号, N'') = N''
   GROUP BY h.单据编号, h.单据日期
)
SELECT CASE WHEN 相关工单数 = 0 THEN N'产品在工单里完全查不到'
            ELSE N'只对得上部分产品(工单不覆盖本单全部产品)' END AS 原因,
       COUNT(*) AS 单数
  FROM e GROUP BY CASE WHEN 相关工单数 = 0 THEN N'产品在工单里完全查不到'
                       ELSE N'只对得上部分产品(工单不覆盖本单全部产品)' END;
