SET NOCOUNT ON;
SELECT COUNT(*) AS 采购入库头数,
       SUM(CASE WHEN 外部单据号 IS NOT NULL AND 外部单据号<>N'' THEN 1 ELSE 0 END) AS 有外部单据号,
       SUM(CASE WHEN ERP单号 IS NOT NULL AND ERP单号<>N'' THEN 1 ELSE 0 END) AS 有ERP单号
FROM bd_purchase_in;
GO
SELECT m.definition FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id WHERE o.name='v_stock_balance';
GO
