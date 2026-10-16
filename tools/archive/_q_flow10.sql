SET NOCOUNT ON;
SELECT COUNT(*) AS sale_out_rows, SUM(CASE WHEN ISNULL(外部单据号,N'')<>N'' THEN 1 ELSE 0 END) AS ext_doc,
 SUM(CASE WHEN ISNULL(来源单号,N'')<>N'' THEN 1 ELSE 0 END) AS has_source,
 SUM(CASE WHEN ISNULL(创建时间,N'')<>N'' THEN 1 ELSE 0 END) AS has_create_time
FROM dbo.bd_sale_out WHERE ISNULL(asp_cancel,'N')<>'Y';
SELECT TOP 3 单据编号, CONVERT(varchar(10),单据日期,120) AS d, ISNULL(仓库,N'') AS wh, ISNULL(来源单号,N'') AS src, ISNULL(外部单据号,N'') AS ext FROM dbo.bd_sale_out WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 单据编号 DESC;
