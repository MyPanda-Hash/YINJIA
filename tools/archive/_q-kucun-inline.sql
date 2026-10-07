SET NOCOUNT ON;
SELECT o.name AS 对象, m.definition FROM sys.sql_modules m JOIN sys.objects o ON o.object_id=m.object_id
WHERE m.definition LIKE '%kucun%' AND o.name IN ('v_stock_movement','v_wo_kit');
GO
