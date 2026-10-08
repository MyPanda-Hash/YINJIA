SET NOCOUNT ON;
PRINT N'=== bs_dict 结构(已有的通用字典表) ===';
SELECT c.name AS 列, ty.name AS 类型, c.max_length/2 AS 字符, c.is_nullable AS 可空,
  (SELECT CAST(value AS nvarchar(160)) FROM sys.extended_properties WHERE major_id=c.object_id AND minor_id=c.column_id AND name='MS_Description') AS 注明
FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.bs_dict') ORDER BY c.column_id;
GO
PRINT N'=== bs_dict 样例数据 ===';
SELECT TOP 10 * FROM bs_dict WHERE 字典类别=N'EQUIP_STATUS';
GO
PRINT N'=== 用 bs_dict 作 dict_sql 的现成样板 ===';
SELECT panel_code AS 面板, label AS 字段, dict_sql AS 字典SQL FROM yj_field WHERE ISNULL(dict_sql,'') LIKE N'%bs_dict%';
GO
PRINT N'=== 「数据字典」面板(能不能在界面加行) ===';
SELECT panel_code, panel_name, category, mode, line_table, pk_col, code_col, page_size FROM yj_panel WHERE panel_code=N'ZDGL';
GO
SELECT f.label AS 字段, f.col_name AS 物理列, f.place, f.seq, f.visible, f.hidden, f.editable
FROM yj_field f WHERE f.panel_code=N'ZDGL' ORDER BY f.seq, f.id;
GO