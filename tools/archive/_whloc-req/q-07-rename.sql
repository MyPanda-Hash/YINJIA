SET NOCOUNT ON;
PRINT N'=== 1. 物理列名含「库位」(改字段名=改物理列,yj_field.col_name 即物理列名) ===';
SELECT t.name AS 表名, c.name AS 列名, ty.name AS 类型, c.max_length AS 字节
FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.name LIKE N'%库位%' ORDER BY t.name, c.column_id;
GO
PRINT N'=== 2. 表/索引/约束/触发器 名含 whloc 或 库位 ===';
SELECT name, type_desc FROM sys.objects WHERE name LIKE N'%whloc%' OR name LIKE N'%库位%' ORDER BY type_desc, name;
GO
PRINT N'=== 3. yj_panel 面板名/码含「库位」 ===';
SELECT panel_code, panel_name, panel_name_en, category, mode, line_table, detail_key, module_group
FROM yj_panel WHERE panel_name LIKE N'%库位%' OR panel_code LIKE N'%LOC%' OR panel_name_en LIKE N'%Location%';
GO
PRINT N'=== 4. yj_field 字段名/标签含「库位」 ===';
SELECT id, panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq, hidden, visible
FROM yj_field WHERE col_name LIKE N'%库位%' OR label LIKE N'%库位%' ORDER BY panel_code, seq, id;
GO
PRINT N'=== 5. yj_translation 词条含「库位」(含译名文本) ===';
SELECT scope, ref_key, locale, text, source FROM yj_translation
WHERE ref_key LIKE N'%库位%' OR text LIKE N'%库位%' OR ref_key LIKE N'%Location%'
ORDER BY scope, ref_key, locale;
GO
PRINT N'=== 6. MS_Description 注释含「库位」的表/列 ===';
SELECT CASE WHEN ep.minor_id=0 THEN N'表' ELSE N'列' END AS 级,
       OBJECT_NAME(ep.major_id) AS 对象,
       CASE WHEN ep.minor_id=0 THEN N'' ELSE COL_NAME(ep.major_id, ep.minor_id) END AS 列名,
       CAST(ep.value AS nvarchar(400)) AS 注明
FROM sys.extended_properties ep
WHERE ep.class=1 AND ep.name='MS_Description' AND CAST(ep.value AS nvarchar(400)) LIKE N'%库位%'
ORDER BY OBJECT_NAME(ep.major_id), ep.minor_id;
GO
PRINT N'=== 7. 视图/存储过程定义含「库位」 ===';
SELECT o.name, o.type_desc FROM sys.sql_modules m JOIN sys.objects o ON o.object_id=m.object_id
WHERE m.definition LIKE N'%库位%' ORDER BY o.name;
GO
PRINT N'=== 8. 其它表 含「库位」的列(全库,含遗留) ===';
SELECT t.name AS 表名, c.name AS 列名 FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
WHERE c.name LIKE N'%库位%' ORDER BY t.name;
GO
PRINT N'=== 9. bs_wh 的仓位/库位相关列(改后需一致) ===';
SELECT c.column_id AS 序, c.name AS 列名, ty.name AS 类型 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.bs_wh') AND (c.name LIKE N'%库位%' OR c.name LIKE N'%仓位%') ORDER BY c.column_id;
GO
PRINT N'=== 10. 全库「仓位」列(保持不动的那些,做对照) ===';
SELECT t.name AS 表名, c.name AS 列名 FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
WHERE c.name LIKE N'%仓位%' ORDER BY t.name, c.column_id;
GO
