SET NOCOUNT ON;
SELECT t.name+N'.'+c.name+N' '+ty.name AS r
FROM sys.columns c JOIN sys.objects t ON t.object_id=c.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE t.name IN ('rd_prod_info_detail') AND c.name NOT LIKE '备用%'
ORDER BY c.column_id;
GO
SELECT panel_code+N' live='+CAST(COUNT(*) AS varchar(10)) AS r FROM rd_approval_detail WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY panel_code;
GO
-- 明细行数样本
SELECT TOP 5 单据编号+N' n='+CAST(COUNT(*) AS varchar(10)) AS r FROM rd_prod_info_detail WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 单据编号 ORDER BY 单据编号 DESC;
GO
