SET NOCOUNT ON;
PRINT N'=== bs_dict 结构 ===';
SELECT c.name AS 列, ty.name AS 类型, c.max_length AS 字节, c.is_nullable AS 可空,
  (SELECT CAST(value AS nvarchar(200)) FROM sys.extended_properties WHERE major_id=c.object_id AND minor_id=c.column_id AND name='MS_Description') AS 注明
FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.bs_dict') ORDER BY c.column_id;
GO
PRINT N'=== bs_dict 现有样例(看 名称/代码/排序 的实际用法) ===';
SELECT TOP 8 * FROM bs_dict WHERE 字典类别='EQUIP_STATUS';
GO
PRINT N'=== 已用 bs_dict 作 dict_sql 的字段(照抄样板) ===';
SELECT panel_code AS 面板, label AS 字段, data_type AS 类型, dict_sql AS 字典SQL
FROM yj_field WHERE ISNULL(dict_sql,'') LIKE N'%bs_dict%';
GO
PRINT N'=== ZDGL 数据字典 面板配置 ===';
SELECT panel_code, panel_name, category, mode, line_table, pk_col, code_col, page_size
FROM yj_panel WHERE panel_code=N'ZDGL';
GO
PRINT N'=== 字段类型取值分布(确认"下拉框"是合法类型) ===';
SELECT data_type AS 类型, COUNT(*) AS 字段数 FROM yj_field GROUP BY data_type ORDER BY COUNT(*) DESC;
GO