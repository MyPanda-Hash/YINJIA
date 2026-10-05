SET NOCOUNT ON;
GO
PRINT '=== bl_pu_order 列(采购订单行) ===';
SELECT c.column_id, c.name AS col, TYPE_NAME(c.user_type_id) AS typ, c.max_length, c.is_nullable
FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.bl_pu_order') ORDER BY c.column_id;
GO
PRINT '=== bd_pu_order 列(前 25) ===';
SELECT TOP 25 c.column_id, c.name AS col, TYPE_NAME(c.user_type_id) AS typ
FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.bd_pu_order') ORDER BY c.column_id;
GO
PRINT '=== 一张样例订单的头/行 ===';
SELECT TOP 3 单据编号, 供应商编码, 供应商, 单据日期 FROM bd_pu_order WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
GO
SELECT TOP 5 id, 单据编号, 行号, 物料编码, 物料名称, 数量, 单位 FROM bl_pu_order WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
GO
