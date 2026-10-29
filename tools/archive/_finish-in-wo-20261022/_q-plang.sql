SET NOCOUNT ON;
SELECT '=== plang 列 ===' AS s;
SELECT c.column_id, c.name, ty.name AS type, c.max_length, c.precision, c.scale, c.is_nullable,
       CAST(ep.value AS nvarchar(200)) AS cmt
  FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
 WHERE c.object_id = OBJECT_ID(N'dbo.plang') ORDER BY c.column_id;
GO
SELECT '=== plang 样例(最近3条) ===' AS s;
SELECT TOP 3 * FROM dbo.plang ORDER BY id DESC;
GO
SELECT '=== 生产工单/入库 面板登记 ===' AS s;
SELECT panel_code, panel_name, mode, line_table, head_table, prefix, date_col, code_col, group_col
  FROM dbo.yj_panel WHERE panel_code IN (N'WORK_ORDER_LIST', N'FINISH_IN', N'WO_REPORT_LIST', N'MANU_ORDER');
GO
SELECT '=== s_allno 列 ===' AS s;
SELECT c.name, ty.name AS type FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID(N'dbo.s_allno') ORDER BY c.column_id;
