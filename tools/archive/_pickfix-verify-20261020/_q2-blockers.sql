SET NOCOUNT ON;
PRINT '--- 相关表的唯一约束/唯一索引(含触发器)---';
SELECT t.name AS 表, i.name AS 索引名, i.type_desc, i.is_unique, i.has_filter,
       STUFF((SELECT ',' + c.name FROM sys.index_columns ic
                 JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
                ORDER BY ic.key_ordinal FOR XML PATH('')), 1, 1, '') AS 键列,
       i.filter_definition AS 过滤条件
  FROM sys.tables t
  JOIN sys.indexes i ON i.object_id = t.object_id
 WHERE t.name IN (N'outh', N'inh', N'kucun', N'bl_material_out', N'bl_manu_order', N'inv_cost_ledger', N'plang')
   AND (i.is_unique = 1 OR i.is_primary_key = 1)
 ORDER BY t.name, i.name;

PRINT '--- 触发器 ---';
SELECT OBJECT_NAME(parent_id) AS 表, name AS 触发器, is_disabled FROM sys.triggers
 WHERE OBJECT_NAME(parent_id) IN (N'outh', N'inh', N'kucun', N'bl_material_out');

PRINT '--- outh/inh 列与类型(键长核对)---';
SELECT OBJECT_NAME(c.object_id) AS 表, c.name AS 列, ty.name AS 类型, c.max_length AS 字节长, c.is_nullable
  FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
 WHERE c.object_id IN (OBJECT_ID('dbo.outh'), OBJECT_ID('dbo.inh'))
   AND c.name IN (N'src', N'rid', N'物料编码', N'批号', N'单据编号', N'单据行号')
 ORDER BY 表, c.column_id;

PRINT '--- 材料出库单(bl_material_out)列 ---';
SELECT c.name AS 列, ty.name AS 类型, c.max_length FROM sys.columns c
  JOIN sys.types ty ON ty.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID('dbo.bl_material_out') ORDER BY c.column_id;
