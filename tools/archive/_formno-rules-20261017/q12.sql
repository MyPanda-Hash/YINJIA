SET NOCOUNT ON;
SELECT TOP 5 单据编号, 是否已转ERP, ISNULL(ERP单号,N'') AS ERP单号, asp_user1, CONVERT(nvarchar(19),asp_time1,120) AS t1
FROM bd_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
PRINT '== 转ERP标记分布 ==';
SELECT ISNULL(是否已转ERP,N'(空)') AS flag, COUNT(*) AS n FROM bd_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 是否已转ERP;
SELECT ISNULL(是否已转ERP,N'(空)') AS flag, COUNT(*) AS n FROM bd_sale_out WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 是否已转ERP;
