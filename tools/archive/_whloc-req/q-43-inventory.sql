SET NOCOUNT ON;
PRINT N'=== A. 全库 yj_field 里含「仓位」的字段(看哪些是本面板的、哪些是别人的) ===';
SELECT panel_code AS 面板, label AS 标签, col_name AS 物理列, place, seq FROM yj_field WHERE label LIKE N'%仓位%' ORDER BY panel_code, seq;
GO
PRINT N'=== B. 精确 label = 仓位 的字段(反向会冲突的就是这些) ===';
SELECT panel_code AS 面板, label AS 标签, col_name AS 物理列 FROM yj_field WHERE label = N'仓位' ORDER BY panel_code;
GO
PRINT N'=== C. yj_translation 里 scope=field/panel 且 ref_key 含「仓位」 ===';
SELECT scope, ref_key, locale, text FROM yj_translation WHERE scope IN ('field','panel') AND ref_key LIKE N'%仓位%' ORDER BY ref_key, locale;
GO
PRINT N'=== D. yj_translation 里 ref_key 含「库位」(现应 0) ===';
SELECT scope, ref_key, locale, text FROM yj_translation WHERE ref_key LIKE N'%库位%' ORDER BY ref_key, locale;
GO
PRINT N'=== E. yj_panel 名字含仓/库 ===';
SELECT panel_code, panel_name, panel_name_en, mode, line_table FROM yj_panel WHERE panel_name LIKE N'%仓%' OR panel_name LIKE N'%库%' ORDER BY panel_code;
GO
PRINT N'=== F. 所有含「仓位」的物理列 + 所属表 ===';
SELECT t.name AS 表, c.name AS 列, ty.name AS 类型
FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.name LIKE N'%仓位%' ORDER BY t.name, c.column_id;
GO