SET NOCOUNT ON;
SELECT N'SALE_OUT' AS panel, COUNT(*) AS rows_cnt, SUM(CASE WHEN ISNULL(外部数据ID,N'')<>N'' THEN 1 ELSE 0 END) AS ext_id,
 SUM(CASE WHEN ISNULL(asp_user1,N'')<>N'' THEN 1 ELSE 0 END) AS has_creator FROM dbo.bd_sale_out WHERE ISNULL(asp_cancel,'N')<>'Y';
SELECT N'FINISH_IN' AS panel, COUNT(*) AS rows_cnt FROM dbo.bd_finish_in WHERE ISNULL(asp_cancel,'N')<>'Y';
SELECT N'MATERIAL_OUT' AS panel, COUNT(*) AS rows_cnt FROM dbo.bd_material_out WHERE ISNULL(asp_cancel,'N')<>'Y';
SELECT TOP 5 单据编号, 单据日期, ISNULL(客户,N'') AS kh, ISNULL(外部数据ID,N'') AS ext FROM dbo.bd_sale_out WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 单据编号 DESC;
