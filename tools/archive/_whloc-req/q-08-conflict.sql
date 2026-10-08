SET NOCOUNT ON;
PRINT N'=== 1. yj_translation 现有「仓位*」词条(改名会撞键?) ===';
SELECT scope, ref_key, locale, text, source FROM yj_translation
WHERE ref_key IN (N'仓位', N'仓位编码', N'仓位地址', N'仓位名称', N'仓位id') ORDER BY ref_key, locale;
GO
PRINT N'=== 2. yj_translation 索引/约束(看 ref_key 是否唯一) ===';
SELECT i.name AS 索引, i.is_unique AS 唯一, i.is_primary_key AS 主键,
       STUFF((SELECT N',' + c2.name FROM sys.index_columns ic2 JOIN sys.columns c2 ON c2.object_id=ic2.object_id AND c2.column_id=ic2.column_id
              WHERE ic2.object_id=i.object_id AND ic2.index_id=i.index_id ORDER BY ic2.key_ordinal FOR XML PATH('')),1,1,N'') AS 列
FROM sys.indexes i WHERE i.object_id = OBJECT_ID('dbo.yj_translation') ORDER BY i.index_id;
GO
PRINT N'=== 3. yj_field 是否已有 label 为「仓位*」的字段(改名后会同名) ===';
SELECT id, panel_code, col_name, label, place, seq, hidden, visible FROM yj_field
WHERE label IN (N'仓位', N'仓位编码', N'仓位地址', N'仓位名称') OR col_name IN (N'仓位', N'仓位编码', N'仓位地址')
ORDER BY label, panel_code;
GO
PRINT N'=== 4. 全库是否有其它表已用「仓位」作列名(与新名撞车) ===';
SELECT t.name AS 表名, c.name AS 列名 FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
WHERE c.name IN (N'仓位', N'仓位编码', N'仓位地址') ORDER BY t.name;
GO
PRINT N'=== 5. bs_wh_loc 上的索引/约束/默认值(改列名要连带确认) ===';
SELECT i.name AS 索引, i.type_desc, i.is_unique,
       STUFF((SELECT N',' + c2.name FROM sys.index_columns ic2 JOIN sys.columns c2 ON c2.object_id=ic2.object_id AND c2.column_id=ic2.column_id
              WHERE ic2.object_id=i.object_id AND ic2.index_id=i.index_id ORDER BY ic2.key_ordinal FOR XML PATH('')),1,1,N'') AS 列
FROM sys.indexes i WHERE i.object_id = OBJECT_ID('dbo.bs_wh_loc') ORDER BY i.index_id;
GO
PRINT N'=== 6. 依赖这三列的对象(视图/函数/过程/默认值) ===';
SELECT DISTINCT o.name AS 依赖对象, o.type_desc
FROM sys.sql_expression_dependencies d JOIN sys.objects o ON o.object_id = d.referencing_id
WHERE d.referenced_id = OBJECT_ID('dbo.bs_wh_loc') OR d.referenced_id = OBJECT_ID('dbo.bs_wh');
GO
PRINT N'=== 7. 默认约束名(改列名后需确认仍绑定) ===';
SELECT dc.name AS 默认约束, OBJECT_NAME(dc.parent_object_id) AS 表, c.name AS 列
FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
WHERE dc.parent_object_id IN (OBJECT_ID('dbo.bs_wh_loc'), OBJECT_ID('dbo.bs_wh'));
GO
PRINT N'=== 8. 库位档案现有数据(改名前存档,5 行) ===';
SELECT id, 仓库, 仓库编码, 库位编码, 库位地址, 停用 FROM dbo.bs_wh_loc ORDER BY id;
GO
