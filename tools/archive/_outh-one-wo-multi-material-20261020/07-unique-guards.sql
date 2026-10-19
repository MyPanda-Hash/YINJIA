/* 只读取证:材料出库链路上的全部唯一索引(看还有没有第二道"一单一领"的闸) */
SET NOCOUNT ON;

PRINT N'== A. 相关表上的唯一索引/唯一约束 ==';
SELECT OBJECT_NAME(i.object_id) AS 表, i.name AS 索引, i.type_desc AS 类型, i.is_unique AS 唯一,
       i.has_filter AS 过滤, i.filter_definition AS 条件,
       STUFF((SELECT ',' + c.name FROM sys.index_columns ic JOIN sys.columns c
                ON c.object_id = ic.object_id AND c.column_id = ic.column_id
               WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
               ORDER BY ic.key_ordinal FOR XML PATH('')), 1, 1, '') AS 键列
  FROM sys.indexes i
  JOIN sys.objects o ON o.object_id = i.object_id AND o.type = 'U'
 WHERE i.is_unique = 1 AND i.is_primary_key = 0
   AND o.name IN (N'ooth', N'inh', N'bd_material_out', N'bl_material_out', N'form_flow_link', N'plang_pc', N'plang')
 ORDER BY 表, 索引;

PRINT N'== B. plang_pc / bl_material_out 的 id 量级(判断 1711 更像谁)==';
SELECT (SELECT MAX(id) FROM dbo.plang_pc) AS plang_pc_maxid,
       (SELECT COUNT(*) FROM dbo.plang_pc) AS plang_pc_行数,
       (SELECT MAX(id) FROM dbo.bl_material_out) AS bl_matout_maxid,
       (SELECT COUNT(*) FROM dbo.bl_material_out) AS bl_matout_行数,
       (SELECT MAX(rid) FROM dbo.outh WHERE src = 6) AS outh6_maxrid;

PRINT N'== C. form_flow_link 结构与唯一键 ==';
SELECT c.name AS 列, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID('dbo.form_flow_link') ORDER BY c.column_id;
