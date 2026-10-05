SET NOCOUNT ON;
GO
PRINT '=== yj_schema_log 结构 ===';
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.yj_schema_log') ORDER BY c.column_id;
GO
PRINT '=== 采购订单头 供应商编码 列 ===';
SELECT TOP 5 单据编号, ISNULL(供应商编码,N'<NULL>') AS 供应商编码, ISNULL(供应商,N'') AS 供应商 FROM bd_pu_order ORDER BY id DESC;
GO
PRINT '=== 各链路单据头/行 批次号 列宽 ===';
SELECT t.name AS tbl, c.name AS col, ty.name AS typ, c.max_length
FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.name = N'批次号' ORDER BY t.name;
GO
