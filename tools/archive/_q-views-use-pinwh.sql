SET NOCOUNT ON;
PRINT '== 引用 bl_purchase_in 的视图 ==';
SELECT DISTINCT OBJECT_NAME(m.object_id) FROM sys.sql_modules m WHERE m.definition LIKE N'%bl_purchase_in%';
GO
PRINT '== 引用 bd_purchase_in 的视图 ==';
SELECT DISTINCT OBJECT_NAME(m.object_id) FROM sys.sql_modules m WHERE m.definition LIKE N'%bd_purchase_in%';
GO
