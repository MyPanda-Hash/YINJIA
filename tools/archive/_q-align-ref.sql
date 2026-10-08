-- 对齐任务取证(正式库):v_manu_schedule 定义 + bl_sale_out.仓库 依赖 + bs_line_capacity 备用列现状
SET NOCOUNT ON;
PRINT '=== 1) v_manu_schedule 定义(正式库) ===';
GO
SELECT m.definition FROM sys.sql_modules m WHERE m.object_id = OBJECT_ID('dbo.v_manu_schedule');
GO
PRINT '=== 2) bl_sale_out.仓库 的列属性(正式库) ===';
GO
SELECT c.name AS 列, t.name AS 类型, c.max_length / 2 AS 字符数, c.is_nullable AS 可空
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.bl_sale_out') AND c.name = N'仓库';
GO
PRINT '=== 3) bl_sale_out 上依赖 仓库 列的索引/约束 ===';
GO
SELECT i.name AS 索引名, i.type_desc AS 类型, COL_NAME(ic.object_id, ic.column_id) AS 列
FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
WHERE i.object_id = OBJECT_ID('dbo.bl_sale_out');
GO
SELECT kc.name AS 约束名, kc.type_desc AS 类型, COL_NAME(kc.parent_object_id, kc.parent_column_id) AS 列
FROM sys.key_constraints kc WHERE kc.parent_object_id = OBJECT_ID('dbo.bl_sale_out');
GO
PRINT '=== 4) bs_line_capacity 现有备用列(正式库) ===';
GO
SELECT COUNT(*) AS 备用列数 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.bs_line_capacity') AND name LIKE N'备用%';
GO
