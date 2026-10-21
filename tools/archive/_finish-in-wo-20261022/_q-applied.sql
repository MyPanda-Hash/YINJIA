SET NOCOUNT ON;
/* 补齐结果清单（一张单一行的干净版本，存成 applied-HSDZ_MES.txt 归档） */
SELECT h.单据编号, h.单据日期, h.加工单号, h.工单行号,
       CAST(p.pl_date AS date) AS 工单日期,
       DATEDIFF(day, CAST(p.pl_date AS date), CAST(h.单据日期 AS date)) AS 相差天,
       (SELECT COUNT(*) FROM dbo.plang p2 WHERE p2.pl_no = h.加工单号) AS 工单行数,
       (SELECT STUFF((SELECT DISTINCT N',' + y.产品编码 FROM dbo.bl_finish_in y
                       WHERE y.单据编号 = h.单据编号 FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, N'')) AS 入库产品,
       (SELECT STUFF((SELECT DISTINCT N',' + ISNULL(l.批号, N'') FROM dbo.bl_finish_in l
                       WHERE l.单据编号 = h.单据编号 FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, N'')) AS 批号
  FROM dbo.bd_finish_in h
  LEFT JOIN dbo.plang p ON p.pl_xc = 1 AND p.pl_no = h.加工单号   -- 取该工单首行日期做参考
 WHERE ISNULL(h.加工单号, N'') <> N''
 ORDER BY h.单据编号;
