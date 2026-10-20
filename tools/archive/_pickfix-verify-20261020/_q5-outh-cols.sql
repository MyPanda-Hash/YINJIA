SET NOCOUNT ON;
SELECT DB_NAME() AS 数据库;
PRINT '--- outh 非空且无默认值的列(建行时需要给值)---';
SELECT c.name AS 列, ty.name AS 类型
  FROM sys.columns c
  JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  LEFT JOIN sys.default_constraints d ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
 WHERE c.object_id = OBJECT_ID('dbo.outh') AND c.is_nullable = 0 AND d.object_id IS NULL
 ORDER BY c.column_id;
PRINT '--- UX_outh_src_rid 当前键列 ---';
SELECT STUFF((SELECT ',' + c.name FROM sys.index_columns ic
                JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
               WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
               ORDER BY ic.key_ordinal FOR XML PATH('')), 1, 1, '') AS 键列
  FROM sys.indexes i WHERE i.object_id = OBJECT_ID('dbo.outh') AND i.name = 'UX_outh_src_rid';
