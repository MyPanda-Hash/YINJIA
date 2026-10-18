SELECT ISNULL(结案,'(null)') AS ja, COUNT(*) AS n FROM dbo.bd_manu_order WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY ISNULL(结案,'(null)');
SELECT TOP 5 合同号, 结案, 结案人, CONVERT(varchar(19),结案时间,120) AS t FROM dbo.bd_manu_order WHERE ISNULL(结案,'')<>'' ORDER BY 结案时间 DESC;
