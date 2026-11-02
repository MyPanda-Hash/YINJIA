SET NOCOUNT ON;
SELECT (SELECT COUNT(*) FROM dbo.bd_finish_in) AS 入库单总数,
       (SELECT COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL(加工单号,N'')<>N'') AS 有加工单号,
       (SELECT COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL(加工单号,N'')=N'') AS 仍为空,
       (SELECT COUNT(*) FROM dbo.bd_finish_in h WHERE ISNULL(h.加工单号,N'')<>N''
          AND NOT EXISTS (SELECT 1 FROM dbo.plang p WHERE p.pl_no = h.加工单号)) AS 指向不存在的工单;
