SET NOCOUNT ON;
SELECT COUNT(*) AS 采购入库头数,
       SUM(CASE WHEN 外部数据ID IS NOT NULL AND 外部数据ID<>N'' THEN 1 ELSE 0 END) AS 有外部数据ID,
       SUM(CASE WHEN 外部单据号 IS NOT NULL AND 外部单据号<>N'' THEN 1 ELSE 0 END) AS 有外部单据号
FROM bd_purchase_in;
GO
SELECT COUNT(*) AS 销售出库头数 FROM bd_sale_out;
GO
SELECT OBJECT_NAME(sm.object_id) AS 视图名, m.definition
FROM sys.sql_modules m JOIN sys.objects sm ON sm.object_id = m.object_id
WHERE sm.name IN ('v_stock_balance');
GO
